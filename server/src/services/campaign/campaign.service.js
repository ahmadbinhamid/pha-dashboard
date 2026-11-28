// services/campaign/campaign.service.js
// Campaign CRUD, sending, scheduling, fan-out and run bookkeeping.

const Campaign = require("../../models/Campaign");
const CampaignRun = require("../../models/CampaignRun");
const contactService = require("./contact.service");
const campaignDelivery = require("./campaign-delivery.service");
const { renderDesignForTenant, designLayout } = require("./email-design.service");
const config = require("../../config");
const { enqueueFanout, enqueueSends, enqueueTestSend } = require("../../queues/campaign.queue");
const { httpError } = require("../../utils/http/httpError");
const { buildAllWordsSearchAnd } = require("../../utils/regex");
const { sanitizeEmailHtml, isBlankHtml } = require("../../utils/emailHtml");
const { computeNextRun, computeFollowingRun } = require("../../utils/campaignSchedule");
const { logger } = require("../../loaders/logging");
const {
  CAMPAIGN_KIND,
  CAMPAIGN_STATUS,
  RUN_STATUS,
  AUDIENCE_TYPE,
  DELIVERY_RESULT,
  FANOUT_CHUNK_SIZE,
  SWEEP_BATCH_SIZE,
} = require("../../constants/campaign.constants");

const EDITABLE_FIELDS = ["name", "kind", "subject", "preheader", "body_html", "design", "audience", "recurrence"];
const RECENT_RUNS_LIMIT = 20;
const RUN_SUMMARY_FIELDS = "status total sent failed skipped started_at finished_at error";

// Statuses that mean a send is pending or under way, so edits are limited.
const LIVE_STATUSES = [CAMPAIGN_STATUS.SCHEDULED, CAMPAIGN_STATUS.ACTIVE];

async function findCampaign(id, tenantId) {
  const campaign = await Campaign.findOne({ _id: id, tenant_id: tenantId }).lean();
  if (!campaign) throw httpError("Campaign not found", 404);
  return campaign;
}

/** Latest run per campaign, one query for the whole page. */
async function latestRunsByCampaign(campaignIds) {
  const rows = await CampaignRun.aggregate([
    { $match: { campaign_id: { $in: campaignIds } } },
    { $sort: { started_at: -1 } },
    { $group: { _id: "$campaign_id", run: { $first: "$$ROOT" } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.run]));
}

async function listCampaigns(tenantId, { skip = 0, limit = 20, search, status, kind } = {}) {
  const filter = { tenant_id: tenantId };
  if (status) filter.status = status;
  if (kind) filter.kind = kind;
  const words = buildAllWordsSearchAnd(["name", "subject"], search);
  if (words.length) filter.$and = words;
  const [items, total] = await Promise.all([
    Campaign.find(filter).select("-body_html").sort({ updated_at: -1 }).skip(skip).limit(limit).lean(),
    Campaign.countDocuments(filter),
  ]);
  const latest = await latestRunsByCampaign(items.map((c) => c._id));
  return { items: items.map((c) => ({ ...c, last_run: latest.get(String(c._id)) ?? null })), total };
}

async function getCampaign(id, tenantId) {
  const campaign = await findCampaign(id, tenantId);
  const picked = campaign.audience?.type === AUDIENCE_TYPE.CONTACTS ? campaign.audience.contact_ids : [];
  const [runs, audienceCount, audienceContacts] = await Promise.all([
    CampaignRun.find({ campaign_id: campaign._id, tenant_id: tenantId })
      .select(RUN_SUMMARY_FIELDS)
      .sort({ started_at: -1 })
      .limit(RECENT_RUNS_LIMIT)
      .lean(),
    contactService.countAudience(tenantId, campaign.audience),
    picked.length ? contactService.findContactsByIds(tenantId, picked) : [],
  ]);
  const limit = config.campaigns.maxRecipients;
  return { ...campaign, runs, audience_count: audienceCount, audience_contacts: audienceContacts, recipient_limit: limit };
}

function normalizeAudience(audience) {
  const type = audience.type ?? AUDIENCE_TYPE.ALL;
  const lists = type === AUDIENCE_TYPE.LISTS ? contactService.normalizeLists(audience.lists) : [];
  const ids = type === AUDIENCE_TYPE.CONTACTS ? [...new Set((audience.contact_ids ?? []).map(String))] : [];
  return { type, lists, contact_ids: ids };
}

/** A design wins over raw HTML: body_html is always re-rendered from it. */
async function normalizeFields(tenantId, input) {
  const next = { ...input };
  if (next.design) next.body_html = await renderDesignForTenant(tenantId, next.design);
  else if (next.body_html !== undefined) next.body_html = sanitizeEmailHtml(next.body_html);
  if (next.audience) next.audience = normalizeAudience(next.audience);
  return next;
}

function pickEditable(fields) {
  return Object.fromEntries(EDITABLE_FIELDS.filter((f) => fields[f] !== undefined).map((f) => [f, fields[f]]));
}

async function createCampaign(tenantId, input) {
  const created = await Campaign.create({ ...pickEditable(await normalizeFields(tenantId, input)), tenant_id: tenantId });
  return getCampaign(created._id, tenantId);
}

/** Saving a live recurring campaign re-times its next send. */
async function updateCampaign(id, tenantId, patch) {
  const current = await findCampaign(id, tenantId);
  if (current.status === CAMPAIGN_STATUS.SENDING) throw httpError("This campaign is sending; edit it once it's done", 409);
  if (current.status === CAMPAIGN_STATUS.SENT) throw httpError("A sent campaign can't be edited; duplicate it instead", 409);
  const fields = pickEditable(await normalizeFields(tenantId, patch));
  if (fields.kind && fields.kind !== current.kind && LIVE_STATUSES.includes(current.status)) {
    throw httpError("Pause the campaign before changing its type", 409);
  }
  const $set = { ...fields };
  if (current.status === CAMPAIGN_STATUS.ACTIVE && fields.recurrence) {
    $set.next_run_at = computeNextRun({ ...current.recurrence, ...fields.recurrence });
  }
  await Campaign.updateOne({ _id: current._id, tenant_id: tenantId }, { $set });
  return getCampaign(id, tenantId);
}

async function deleteCampaign(id, tenantId) {
  const campaign = await Campaign.findOne({ _id: id, tenant_id: tenantId });
  if (!campaign) throw httpError("Campaign not found", 404);
  if (campaign.status === CAMPAIGN_STATUS.SENDING) throw httpError("Wait for this campaign to finish sending", 409);
  await campaign.softDelete();
  return { _id: campaign._id };
}

async function duplicateCampaign(id, tenantId) {
  const source = await findCampaign(id, tenantId);
  const copy = pickEditable(source);
  return createCampaign(tenantId, { ...copy, name: `${source.name} (copy)` });
}

function recipientLimitError(count) {
  const limit = config.campaigns.maxRecipients;
  return httpError(`This audience has ${count} subscribed contacts; one send can reach at most ${limit}`, 422);
}

/** Content and audience must be complete, and within the cap, to send. */
async function assertSendable(campaign) {
  if (!campaign.subject?.trim()) throw httpError("Add a subject line first", 422);
  if (isBlankHtml(campaign.body_html)) throw httpError("Design the email content first", 422);
  const { type, lists, contact_ids: ids } = campaign.audience ?? {};
  if (type === AUDIENCE_TYPE.LISTS && !lists?.length) throw httpError("Pick at least one contact list", 422);
  if (type === AUDIENCE_TYPE.CONTACTS && !ids?.length) throw httpError("Pick at least one contact", 422);
  const count = await contactService.countAudience(campaign.tenant_id, campaign.audience);
  if (!count) throw httpError("Nobody in this audience is subscribed", 422);
  if (count > config.campaigns.maxRecipients) throw recipientLimitError(count);
}

/** Freezes content into a run and queues its fan-out. */
async function startRun(campaign) {
  const run = await CampaignRun.create({
    tenant_id: campaign.tenant_id,
    campaign_id: campaign._id,
    subject: campaign.subject,
    preheader: campaign.preheader,
    body_html: campaign.body_html,
    layout: designLayout(campaign.design),
  });
  await Campaign.updateOne({ _id: campaign._id }, { $set: { last_run_at: run.started_at }, $inc: { runs_count: 1 } });
  try {
    await enqueueFanout(run._id);
  } catch (err) {
    await failRun(run._id, err.message);
    throw err;
  }
  return run;
}

/** One-time only; claims the send atomically so double clicks send once. */
async function sendCampaignNow(id, tenantId) {
  const current = await findCampaign(id, tenantId);
  if (current.kind !== CAMPAIGN_KIND.ONE_TIME) throw httpError("Recurring newsletters send on their schedule", 409);
  await assertSendable(current);
  const claimed = await Campaign.findOneAndUpdate(
    { _id: current._id, tenant_id: tenantId, status: { $in: [CAMPAIGN_STATUS.DRAFT, CAMPAIGN_STATUS.SCHEDULED] } },
    { $set: { status: CAMPAIGN_STATUS.SENDING, next_run_at: null } },
    { new: true },
  ).lean();
  if (!claimed) throw httpError("This campaign has already been sent", 409);
  try {
    await startRun(claimed);
  } catch (err) {
    await Campaign.updateOne({ _id: claimed._id }, { $set: { status: CAMPAIGN_STATUS.DRAFT } });
    throw httpError(`Couldn't start sending: ${err.message}`, 503);
  }
  return getCampaign(id, tenantId);
}

/** One-time: send at `scheduled_at`. Recurring: switch the schedule on. */
async function scheduleCampaign(id, tenantId, { scheduled_at } = {}) {
  const current = await findCampaign(id, tenantId);
  await assertSendable(current);
  let $set;
  if (current.kind === CAMPAIGN_KIND.ONE_TIME) {
    if (![CAMPAIGN_STATUS.DRAFT, CAMPAIGN_STATUS.SCHEDULED].includes(current.status)) {
      throw httpError("This campaign has already been sent", 409);
    }
    const at = new Date(scheduled_at);
    if (!scheduled_at || Number.isNaN(at.getTime()) || at <= new Date()) throw httpError("Pick a time in the future", 422);
    $set = { status: CAMPAIGN_STATUS.SCHEDULED, scheduled_at: at, next_run_at: at };
  } else {
    $set = { status: CAMPAIGN_STATUS.ACTIVE, next_run_at: computeNextRun(current.recurrence) };
  }
  await Campaign.updateOne({ _id: current._id, tenant_id: tenantId }, { $set });
  return getCampaign(id, tenantId);
}

async function pauseCampaign(id, tenantId) {
  const current = await findCampaign(id, tenantId);
  const next = { [CAMPAIGN_STATUS.SCHEDULED]: CAMPAIGN_STATUS.DRAFT, [CAMPAIGN_STATUS.ACTIVE]: CAMPAIGN_STATUS.PAUSED }[current.status];
  if (!next) throw httpError("Only a scheduled or active campaign can be paused", 409);
  await Campaign.updateOne(
    { _id: current._id, tenant_id: tenantId, status: current.status },
    { $set: { status: next, next_run_at: null } },
  );
  return getCampaign(id, tenantId);
}

async function sendTestEmail(id, tenantId, to) {
  const campaign = await findCampaign(id, tenantId);
  await assertSendable(campaign);
  await enqueueTestSend(campaign._id, tenantId, to);
  return { to };
}

async function countCampaignAudience(tenantId, audience) {
  const count = await contactService.countAudience(tenantId, normalizeAudience(audience));
  return { count, limit: config.campaigns.maxRecipients };
}

/** Renders unsaved editor content exactly as it would be emailed. */
async function previewCampaign(tenantId, { design, subject, preheader }) {
  const body = await renderDesignForTenant(tenantId, design);
  const content = { tenant_id: tenantId, subject, preheader, body_html: body, layout: designLayout(design) };
  return campaignDelivery.renderPreview(content);
}

/** Moves a due campaign's next_run_at on; false if another sweep got it. */
async function claimDueCampaign(campaign, now) {
  const oneTime = campaign.kind === CAMPAIGN_KIND.ONE_TIME;
  const $set = oneTime
    ? { status: CAMPAIGN_STATUS.SENDING, next_run_at: null }
    : { next_run_at: computeFollowingRun(campaign.recurrence, campaign.next_run_at, now) };
  const claimed = await Campaign.updateOne(
    { _id: campaign._id, status: campaign.status, next_run_at: campaign.next_run_at },
    { $set },
  );
  return claimed.modifiedCount === 1;
}

async function runDueCampaign(campaign, now) {
  if (!(await claimDueCampaign(campaign, now))) return false;
  try {
    await assertSendable(campaign);
    await startRun(campaign);
  } catch (err) {
    logger.error("[campaign] scheduled send failed to start", { campaignId: String(campaign._id), error: err.message });
    if (campaign.kind === CAMPAIGN_KIND.ONE_TIME) {
      await Campaign.updateOne({ _id: campaign._id }, { $set: { status: CAMPAIGN_STATUS.DRAFT } });
    }
    return false;
  }
  return true;
}

/** Starts every campaign whose next_run_at has passed, across all tenants. */
async function sweepDueCampaigns(now = new Date()) {
  const filter = { status: { $in: LIVE_STATUSES }, next_run_at: { $ne: null, $lte: now } };
  let started = 0;
  for (;;) {
    const due = await Campaign.find(filter).sort({ next_run_at: 1 }).limit(SWEEP_BATCH_SIZE).lean();
    if (!due.length) break;
    for (const campaign of due) if (await runDueCampaign(campaign, now)) started += 1;
    if (due.length < SWEEP_BATCH_SIZE) break;
  }
  return { started };
}

async function findRun(runId) {
  return CampaignRun.findById(runId).lean();
}

async function flushSendChunk(runId, ids) {
  if (ids.length) await enqueueSends(runId, ids.splice(0));
}

/** Walks the audience in chunks and queues one send per subscribed contact. */
async function processFanout(runId) {
  const run = await findRun(runId);
  if (!run || run.fanout_done || run.status === RUN_STATUS.FAILED) return { skipped: true };
  const campaign = await Campaign.findById(run.campaign_id).select("tenant_id audience").lean();
  if (!campaign) {
    await failRun(run._id, "Campaign deleted");
    return { skipped: true };
  }
  await CampaignRun.updateOne({ _id: run._id }, { $set: { status: RUN_STATUS.SENDING } });
  await contactService.syncOptedInCustomers(run.tenant_id);
  // The audience can grow between scheduling and sending; recheck the cap.
  const audienceSize = await contactService.countAudience(run.tenant_id, campaign.audience);
  if (audienceSize > config.campaigns.maxRecipients) {
    await failRun(run._id, recipientLimitError(audienceSize).message);
    return { skipped: true };
  }

  let total = 0;
  const chunk = [];
  for await (const { _id } of contactService.cursorAudienceIds(run.tenant_id, campaign.audience)) {
    chunk.push(_id);
    total += 1;
    if (chunk.length >= FANOUT_CHUNK_SIZE) await flushSendChunk(run._id, chunk);
  }
  await flushSendChunk(run._id, chunk);
  await CampaignRun.updateOne({ _id: run._id }, { $set: { total, fanout_done: true } });
  await completeRunIfDone(run._id);
  return { total };
}

/** Marks the run done once every queued send has reported back. */
async function completeRunIfDone(runId) {
  const run = await CampaignRun.findOneAndUpdate(
    {
      _id: runId,
      status: RUN_STATUS.SENDING,
      fanout_done: true,
      $expr: { $gte: [{ $add: ["$sent", "$failed", "$skipped"] }, "$total"] },
    },
    { $set: { status: RUN_STATUS.COMPLETED, finished_at: new Date() } },
    { new: true },
  ).lean();
  if (!run) return;
  await Campaign.updateOne(
    { _id: run.campaign_id, kind: CAMPAIGN_KIND.ONE_TIME, status: CAMPAIGN_STATUS.SENDING },
    { $set: { status: CAMPAIGN_STATUS.SENT } },
  );
}

async function recordDelivery(runId, result) {
  await CampaignRun.updateOne({ _id: runId }, { $inc: { [result]: 1 } });
  await completeRunIfDone(runId);
}

const runContent = (run) => ({
  tenant_id: run.tenant_id,
  subject: run.subject,
  preheader: run.preheader,
  body_html: run.body_html,
  layout: run.layout ?? designLayout(run.design),
});

const isFinalAttempt = (job) => job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

async function attemptDelivery(job, run) {
  try {
    return await campaignDelivery.deliverToContact(runContent(run), job.data.contactId);
  } catch (err) {
    if (!isFinalAttempt(job)) throw err;
    logger.error("[campaign] send crashed on final attempt", { runId: String(run._id), error: err.message });
    return { result: DELIVERY_RESULT.FAILED, permanent: true };
  }
}

/** Bull processor: final failures are counted, transient ones retried. */
async function processSendJob(job) {
  const run = await findRun(job.data.runId);
  if (!run || run.status !== RUN_STATUS.SENDING) return DELIVERY_RESULT.SKIPPED;
  const { result, permanent } = await attemptDelivery(job, run);
  if (result === DELIVERY_RESULT.FAILED && !permanent && !isFinalAttempt(job)) {
    throw new Error("Campaign send failed, retrying");
  }
  await recordDelivery(run._id, result);
  return result;
}

/** Bull processor; a fan-out that keeps failing fails its run, not hangs it. */
async function processFanoutJob(job) {
  try {
    return await processFanout(job.data.runId);
  } catch (err) {
    if (isFinalAttempt(job)) await failRun(job.data.runId, err.message);
    throw err;
  }
}

async function failRun(runId, error) {
  const run = await CampaignRun.findOneAndUpdate(
    { _id: runId, status: { $in: [RUN_STATUS.QUEUED, RUN_STATUS.SENDING] } },
    { $set: { status: RUN_STATUS.FAILED, error, finished_at: new Date() } },
    { new: true },
  ).lean();
  if (!run) return;
  await Campaign.updateOne(
    { _id: run.campaign_id, kind: CAMPAIGN_KIND.ONE_TIME, status: CAMPAIGN_STATUS.SENDING },
    { $set: { status: CAMPAIGN_STATUS.DRAFT } },
  );
}

async function processTestJob(job) {
  const { campaignId, tenantId, to } = job.data;
  const campaign = await Campaign.findOne({ _id: campaignId, tenant_id: tenantId }).lean();
  if (!campaign) return false;
  const sent = await campaignDelivery.deliverTest(runContent(campaign), to);
  if (!sent.ok && !sent.permanent) throw new Error("Test send failed");
  return sent.ok;
}

module.exports = {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  duplicateCampaign,
  sendCampaignNow,
  scheduleCampaign,
  pauseCampaign,
  sendTestEmail,
  countCampaignAudience,
  previewCampaign,
  sweepDueCampaigns,
  processFanoutJob,
  processSendJob,
  processTestJob,
};
