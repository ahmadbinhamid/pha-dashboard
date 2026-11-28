// services/followup/feedback.service.js
// Ratings from follow-up emails: the public form, the inbox and alerts.

const mongoose = require("mongoose");
const Feedback = require("../../models/Feedback");
const FollowUp = require("../../models/FollowUp");
const FollowUpSend = require("../../models/FollowUpSend");
const { getOrderForFollowUp } = require("../order.service");
const { getCompanyProfile } = require("../tenant-settings.service");
const { optOutEmail } = require("../campaign/contact.service");
const { sendLowRatingAlert } = require("../email/email.service");
const { ratableItems } = require("./follow-up-email.service");
const { httpError } = require("../../utils/http/httpError");
const { buildAllWordsSearchAnd } = require("../../utils/regex");
const { withAttachmentUrls } = require("../../utils/attachment");
const { formatOrderNumber } = require("../../utils/orderNumberFormat");
const { logger } = require("../../loaders/logging");
const { FOLLOW_UP_SEND_STATUS, RATING } = require("../../constants/followup.constants");

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

async function findSendByToken(token) {
  const send = await FollowUpSend.findOne({ token }).lean();
  if (!send) throw httpError("This feedback link isn't valid", 404);
  return send;
}

/** The products to rate, with any ratings already given. */
async function getFeedbackForm(token) {
  const send = await findSendByToken(token);
  const [order, existing, profile] = await Promise.all([
    getOrderForFollowUp(send.order_id),
    Feedback.find({ follow_up_send_id: send._id }).lean(),
    getCompanyProfile(send.tenant_id),
  ]);
  if (!order) throw httpError("This order is no longer available", 404);
  const given = new Map(existing.map((f) => [String(f.item_id), f]));
  return {
    store_name: profile.company_name || "",
    order_number: formatOrderNumber(order.order_number_prefix, order.order_number),
    first_name: String(order.customer?.name ?? "").trim().split(/\s+/)[0] || "",
    items: ratableItems(order).map((item) => ({
      item_id: String(item._id),
      name: item.name,
      image: withAttachmentUrls(item.product?.attachments ?? [])[0]?.url ?? null,
      product_slug: item.product?.slug ?? null,
      rating: given.get(String(item._id))?.rating ?? null,
      comment: given.get(String(item._id))?.comment ?? "",
    })),
  };
}

/** Emails the store once per low rating, so unhappy buyers get a call. */
async function alertIfLow(followUp, feedback) {
  if (!followUp?.alert_at_or_below || feedback.rating > followUp.alert_at_or_below) return;
  const claimed = await Feedback.findOneAndUpdate({ _id: feedback._id, alerted_at: null }, { $set: { alerted_at: new Date() } }).lean();
  if (!claimed) return;
  try {
    const profile = await getCompanyProfile(feedback.tenant_id);
    const to = followUp.alert_email || profile.email;
    if (to) await sendLowRatingAlert({ to, feedback, companyProfile: profile });
  } catch (err) {
    logger.warn("[feedback] low rating alert failed", { feedbackId: String(feedback._id), error: err.message });
  }
}

/** Saves ratings for lines of this order; resubmitting updates them. */
async function submitFeedback(token, ratings) {
  const send = await findSendByToken(token);
  const order = await getOrderForFollowUp(send.order_id);
  if (!order) throw httpError("This order is no longer available", 404);
  const lines = new Map(ratableItems(order).map((item) => [String(item._id), item]));
  const followUp = await FollowUp.findById(send.follow_up_id).setOptions({ withDeleted: true }).lean();
  const saved = [];
  for (const { item_id: itemId, rating, comment } of ratings) {
    const line = lines.get(itemId);
    if (!line) throw httpError("That product isn't part of this order", 422);
    const feedback = await Feedback.findOneAndUpdate(
      { follow_up_send_id: send._id, item_id: line._id },
      {
        $set: { rating, ...(comment !== undefined && { comment }) },
        $setOnInsert: {
          tenant_id: send.tenant_id,
          order_id: order._id,
          product_id: line.product?._id ?? null,
          product_name: line.name,
          customer_name: order.customer?.name ?? "",
          customer_email: send.email,
        },
      },
      { upsert: true, new: true },
    ).lean();
    await alertIfLow(followUp, feedback);
    saved.push({ item_id: itemId, rating: feedback.rating, comment: feedback.comment });
  }
  return { saved };
}

async function optOutByToken(token) {
  const send = await findSendByToken(token);
  await optOutEmail(send.tenant_id, send.email);
  const profile = await getCompanyProfile(send.tenant_id);
  return { email: send.email, store_name: profile.company_name || "this store" };
}

async function describeOptOut(token) {
  const send = await FollowUpSend.findOne({ token }).lean();
  if (!send) return null;
  const profile = await getCompanyProfile(send.tenant_id);
  return { email: send.email, store_name: profile.company_name || "this store" };
}

// ── dashboard ──

function listFilter(tenantId, { search, rating, maxRating }) {
  const filter = { tenant_id: tenantId };
  if (rating) filter.rating = rating;
  else if (maxRating) filter.rating = { $lte: maxRating };
  const words = buildAllWordsSearchAnd(["product_name", "customer_name", "customer_email", "comment"], search);
  if (words.length) filter.$and = words;
  return filter;
}

async function listFeedback(tenantId, { skip = 0, limit = 25, ...filters } = {}) {
  const filter = listFilter(tenantId, filters);
  const [items, total] = await Promise.all([
    Feedback.find(filter).populate("order_id", "order_number order_number_prefix").sort({ updated_at: -1 }).skip(skip).limit(limit).lean(),
    Feedback.countDocuments(filter),
  ]);
  return {
    items: items.map(({ order_id: order, ...f }) => ({
      ...f,
      order_id: order?._id ?? null,
      order_number: order ? formatOrderNumber(order.order_number_prefix, order.order_number) : null,
    })),
    total,
  };
}

/** Average, spread of stars, and how many emailed customers answered. */
async function getFeedbackStats(tenantId) {
  const tid = toObjectId(tenantId);
  const [dist, sent, answered] = await Promise.all([
    Feedback.aggregate([{ $match: { tenant_id: tid } }, { $group: { _id: "$rating", n: { $sum: 1 } } }]),
    FollowUpSend.countDocuments({ tenant_id: tid, status: FOLLOW_UP_SEND_STATUS.SENT }),
    Feedback.distinct("follow_up_send_id", { tenant_id: tid }),
  ]);
  const distribution = Object.fromEntries(Array.from({ length: RATING.MAX }, (_, i) => [i + 1, 0]));
  let count = 0;
  let sum = 0;
  for (const { _id, n } of dist) {
    distribution[_id] = n;
    count += n;
    sum += _id * n;
  }
  return {
    count,
    average: count ? Math.round((sum / count) * 10) / 10 : null,
    distribution,
    low: distribution[1] + distribution[2],
    emails_sent: sent,
    response_rate: sent ? Math.round((answered.length / sent) * 100) : null,
  };
}

module.exports = { getFeedbackForm, submitFeedback, optOutByToken, describeOptOut, listFeedback, getFeedbackStats };
