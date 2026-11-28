// services/followup/follow-up.service.js
// Follow-up setup, the sweep that finds due orders, and each send.

const { toObjectId } = require("../../utils/objectId");
const { pickDefined } = require("../../utils/pickDefined");
const FollowUp = require("../../models/FollowUp");
const FollowUpSend = require("../../models/FollowUpSend");
const { cursorOrdersDueForFollowUp, getOrderForFollowUp } = require("../order.service");
const { findSuppressedEmails } = require("../campaign/contact.service");
const { renderDesignForTenant } = require("../campaign/email-design.service");
const { renderFollowUpEmail } = require("./follow-up-email.service");
const { sendEmail } = require("../email/mailer");
const { enqueueFollowUpSends } = require("../../queues/campaign.queue");
const { httpError } = require("../../utils/http/httpError");
const { isBlankHtml } = require("../../utils/emailHtml");
const { logger } = require("../../loaders/logging");
const { ORDER_STATUS } = require("../../constants/order.constants");
const { FOLLOW_UP_SEND_STATUS, FOLLOW_UP_LIMITS, FOLLOW_UP_SWEEP_BATCH } = require("../../constants/followup.constants");

const EDITABLE_FIELDS = [
  "name",
  "shipped_delay_days",
  "handover_delay_days",
  "channels",
  "subject",
  "preheader",
  "design",
  "ask_for_rating",
  "alert_at_or_below",
  "alert_email",
];
const DAY_MS = 86_400_000;

const pickEditable = (input) => pickDefined(input, EDITABLE_FIELDS);

async function findFollowUp(id, tenantId) {
  const followUp = await FollowUp.findOne({ _id: id, tenant_id: tenantId }).lean();
  if (!followUp) throw httpError("Follow-up not found", 404);
  return followUp;
}

/** Sent / failed / skipped counts per follow-up, one aggregate. */
async function sendCounts(tenantId, ids) {
  const rows = await FollowUpSend.aggregate([
    { $match: { tenant_id: toObjectId(tenantId), follow_up_id: { $in: ids } } },
    { $group: { _id: { f: "$follow_up_id", s: "$status" }, n: { $sum: 1 } } },
  ]);
  const byId = new Map();
  for (const { _id, n } of rows) {
    const counts = byId.get(String(_id.f)) ?? { queued: 0, sent: 0, failed: 0, skipped: 0 };
    counts[_id.s] = n;
    byId.set(String(_id.f), counts);
  }
  return byId;
}

async function listFollowUps(tenantId) {
  const items = await FollowUp.find({ tenant_id: tenantId }).select("-body_html -design").sort({ created_at: -1 }).lean();
  const counts = await sendCounts(tenantId, items.map((f) => f._id));
  return items.map((f) => ({ ...f, sends: counts.get(String(f._id)) ?? { queued: 0, sent: 0, failed: 0, skipped: 0 } }));
}

async function getFollowUp(id, tenantId) {
  const followUp = await findFollowUp(id, tenantId);
  const counts = await sendCounts(tenantId, [followUp._id]);
  return { ...followUp, sends: counts.get(String(followUp._id)) ?? { queued: 0, sent: 0, failed: 0, skipped: 0 } };
}

async function withRenderedBody(tenantId, fields) {
  return fields.design ? { ...fields, body_html: await renderDesignForTenant(tenantId, fields.design) } : fields;
}

function assertSendable(followUp) {
  if (!followUp.subject?.trim()) throw httpError("Add a subject line before switching it on", 422);
  if (isBlankHtml(followUp.body_html) && !followUp.ask_for_rating) throw httpError("Design the email before switching it on", 422);
  if (!followUp.channels?.length) throw httpError("Pick at least one sales channel", 422);
}

async function createFollowUp(tenantId, input) {
  if ((await FollowUp.countDocuments({ tenant_id: tenantId })) >= FOLLOW_UP_LIMITS.MAX_FOLLOW_UPS) {
    throw httpError(`You can have up to ${FOLLOW_UP_LIMITS.MAX_FOLLOW_UPS} follow-ups`, 409);
  }
  const created = await FollowUp.create({ ...(await withRenderedBody(tenantId, pickEditable(input))), tenant_id: tenantId });
  return getFollowUp(created._id, tenantId);
}

async function updateFollowUp(id, tenantId, patch) {
  const current = await findFollowUp(id, tenantId);
  const $set = await withRenderedBody(tenantId, pickEditable(patch));
  if (current.enabled) assertSendable({ ...current, ...$set });
  await FollowUp.updateOne({ _id: current._id, tenant_id: tenantId }, { $set });
  return getFollowUp(id, tenantId);
}

/** Switching on starts the clock: only orders completed from now count. */
async function setFollowUpEnabled(id, tenantId, enabled) {
  const current = await findFollowUp(id, tenantId);
  if (enabled) assertSendable(current);
  const $set = enabled ? { enabled: true, ...(!current.enabled && { enabled_at: new Date() }) } : { enabled: false };
  await FollowUp.updateOne({ _id: current._id, tenant_id: tenantId }, { $set });
  return getFollowUp(id, tenantId);
}

async function deleteFollowUp(id, tenantId) {
  const followUp = await FollowUp.findOne({ _id: id, tenant_id: tenantId });
  if (!followUp) throw httpError("Follow-up not found", 404);
  await followUp.softDelete();
  return { _id: followUp._id };
}

/** Unsaved editor content rendered against a sample order. */
async function previewFollowUp(tenantId, input) {
  const followUp = await withRenderedBody(tenantId, { ask_for_rating: true, ...input });
  const { subject, html } = await renderFollowUpEmail({ followUp, order: null, token: null, tenantId });
  return { subject, html };
}

// ── sweep ──

/** Due-date window for one follow-up, by delivery method. */
function dueWindow(followUp, now) {
  const longest = Math.max(followUp.shipped_delay_days, followUp.handover_delay_days);
  const oldest = new Date(now - (longest + FOLLOW_UP_LIMITS.MAX_LATE_DAYS) * DAY_MS);
  return {
    since: followUp.enabled_at > oldest ? followUp.enabled_at : oldest,
    shippedBefore: new Date(now - followUp.shipped_delay_days * DAY_MS),
    handoverBefore: new Date(now - followUp.handover_delay_days * DAY_MS),
  };
}

/** Records sends for a batch of due orders; returns the ids to email. */
async function recordBatch(followUp, orders) {
  const ids = orders.map((o) => o._id);
  const already = new Set((await FollowUpSend.find({ follow_up_id: followUp._id, order_id: { $in: ids } }).select("order_id").lean()).map((s) => String(s.order_id)));
  const fresh = orders.filter((o) => !already.has(String(o._id)));
  if (!fresh.length) return [];
  const suppressed = await findSuppressedEmails(followUp.tenant_id, fresh.map((o) => o.customer.email));
  const docs = fresh.map((o) => ({
    tenant_id: followUp.tenant_id,
    follow_up_id: followUp._id,
    order_id: o._id,
    email: o.customer.email,
    status: suppressed.has(o.customer.email) ? FOLLOW_UP_SEND_STATUS.SKIPPED : FOLLOW_UP_SEND_STATUS.QUEUED,
  }));
  try {
    const inserted = await FollowUpSend.insertMany(docs, { ordered: false });
    return inserted.filter((d) => d.status === FOLLOW_UP_SEND_STATUS.QUEUED).map((d) => d._id);
  } catch (err) {
    // A racing sweep inserted some first; email only what this one created.
    const created = err.insertedDocs ?? [];
    if (err.code !== 11000 && !err.writeErrors) throw err;
    return created.filter((d) => d.status === FOLLOW_UP_SEND_STATUS.QUEUED).map((d) => d._id);
  }
}

/** Queues due emails for one follow-up; returns how many were queued. */
async function sweepFollowUp(followUp, now = new Date()) {
  const cursor = cursorOrdersDueForFollowUp({ tenantId: followUp.tenant_id, channels: followUp.channels, ...dueWindow(followUp, now) });
  let queued = 0;
  const batch = [];
  const flush = async () => {
    const ids = await recordBatch(followUp, batch.splice(0));
    if (ids.length) await enqueueFollowUpSends(ids);
    queued += ids.length;
  };
  for await (const order of cursor) {
    batch.push(order);
    if (batch.length >= FOLLOW_UP_SWEEP_BATCH) await flush();
  }
  if (batch.length) await flush();
  return queued;
}

/** Queues every due follow-up email across all tenants. */
async function sweepFollowUps(now = new Date()) {
  const followUps = await FollowUp.find({ enabled: true, enabled_at: { $ne: null } }).lean();
  let queued = 0;
  for (const followUp of followUps) {
    try {
      queued += await sweepFollowUp(followUp, now);
    } catch (err) {
      logger.error("[follow-up] sweep failed", { followUpId: String(followUp._id), error: err.message });
    }
  }
  return { followUps: followUps.length, queued };
}

// ── delivery ──

const markSend = (id, status, extra = {}) => FollowUpSend.updateOne({ _id: id }, { $set: { status, ...extra } });

/** Bull processor: skips sends that stopped making sense since queueing. */
async function processFollowUpSendJob(job) {
  const send = await FollowUpSend.findById(job.data.sendId).lean();
  if (!send || send.status !== FOLLOW_UP_SEND_STATUS.QUEUED) return "skipped";
  const [followUp, order] = await Promise.all([FollowUp.findById(send.follow_up_id).lean(), getOrderForFollowUp(send.order_id)]);
  const refunded = [ORDER_STATUS.REFUNDED, ORDER_STATUS.CANCELLED].includes(order?.status);
  const suppressed = (await findSuppressedEmails(send.tenant_id, [send.email])).size > 0;
  if (!followUp?.enabled || !order || refunded || suppressed) {
    await markSend(send._id, FOLLOW_UP_SEND_STATUS.SKIPPED);
    return "skipped";
  }
  const { subject, html, profile } = await renderFollowUpEmail({ followUp, order, token: send.token, tenantId: send.tenant_id });
  const result = await sendEmail({
    tenantId: send.tenant_id,
    fromName: profile.company_name || undefined,
    replyTo: profile.email || undefined,
    to: send.email,
    subject,
    html,
    template: "followUp",
  });
  const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
  if (!result.ok && !result.permanent && !finalAttempt) throw new Error("Follow-up send failed, retrying");
  await markSend(
    send._id,
    result.ok ? FOLLOW_UP_SEND_STATUS.SENT : FOLLOW_UP_SEND_STATUS.FAILED,
    result.ok ? { sent_at: new Date() } : { error: String(result.response || "Send failed").slice(0, 300) },
  );
  return result.ok ? "sent" : "failed";
}

module.exports = {
  listFollowUps,
  getFollowUp,
  createFollowUp,
  updateFollowUp,
  setFollowUpEnabled,
  deleteFollowUp,
  previewFollowUp,
  sweepFollowUp,
  sweepFollowUps,
  processFollowUpSendJob,
};
