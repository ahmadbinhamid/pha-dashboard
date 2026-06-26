// services/ebay/ebay.webhook.service.js

const crypto = require("crypto");
const { getAppToken } = require("./ebay.api.service");
const { adjustStockBySku } = require("../inventory.service");
const EbayProcessedOrder = require("../../models/EbayProcessedOrder");
const { logger } = require("../../loaders/logging");
const { MARKETPLACE_PLATFORM } = require("../../constants/marketplace.constants");
const config = require("../../config");

const BASE = config.ebay.sandbox
  ? "https://api.sandbox.ebay.com"
  : "https://api.ebay.com";
const EBAY_NOTIFICATION_API = `${BASE}/commerce/notification/v1`;
const TOPICS = ["ORDER.LINE_ITEMS_CREATED", "ORDER.LINE_ITEMS_UPDATED"];

function verifyChallenge(challengeCode, endpointUrl, verificationToken) {
  return crypto
    .createHash("sha256")
    .update(challengeCode + verificationToken + endpointUrl)
    .digest("hex");
}

function verifySignature(rawBody, signatureHeader, verificationToken) {
  if (!signatureHeader || !rawBody) return false;
  try {
    const expected = crypto
      .createHmac("sha256", verificationToken)
      .update(rawBody)
      .digest("base64");
    const providedBuf = Buffer.from(signatureHeader, "base64");
    const expectedBuf = Buffer.from(expected, "base64");
    if (providedBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(providedBuf, expectedBuf);
  } catch {
    return false;
  }
}

// Returns true if this is a new event that should be processed,
// false if it was already processed (duplicate key = race won by other path).
async function claimEvent(orderId, action) {
  try {
    await EbayProcessedOrder.create({
      platform: MARKETPLACE_PLATFORM.EBAY,
      orderId,
      action,
      source: "webhook",
      lineItems: [],
    });
    return true;
  } catch (err) {
    if (err.code === 11000) return false; // already handled
    throw err;
  }
}

async function processNotification(payload) {
  const topic = payload?.metadata?.topic;
  const data = payload?.notification?.data;

  if (!topic || !data) {
    logger.warn("[ebay.webhook] Missing topic or data in payload");
    return { processed: false };
  }

  // Best-effort orderId: prefer data.orderId, fall back to notificationId.
  // notificationId is always present and unique per notification event.
  const orderId = data.orderId || payload?.notification?.notificationId;

  if (topic === "ORDER.LINE_ITEMS_CREATED") {
    const sku = data.sku;
    const qty = Number(data.quantity) || 1;

    if (!sku) {
      logger.warn("[ebay.webhook] No SKU in ORDER.LINE_ITEMS_CREATED payload");
      return { processed: false };
    }

    if (!orderId) {
      // No stable key — log and bail rather than risk a double-deduction
      logger.warn("[ebay.webhook] ORDER.LINE_ITEMS_CREATED has no orderId or notificationId — skipping to avoid double deduction");
      return { processed: false };
    }

    const claimed = await claimEvent(orderId, "deduction");
    if (!claimed) {
      logger.info(`[ebay.webhook] Order ${orderId} deduction already recorded — skipping`);
      return { processed: false, reason: "already_processed" };
    }

    await adjustStockBySku(sku, -qty);

    await EbayProcessedOrder.updateOne(
      { platform: MARKETPLACE_PLATFORM.EBAY, orderId, action: "deduction" },
      { $set: { lineItems: [{ sku, quantity: qty }] } },
    );

    logger.info(`[ebay.webhook] Deducted ${qty} × ${sku} for order ${orderId}`);
    return { processed: true, topic, sku, qty: -qty };
  }

  if (topic === "ORDER.LINE_ITEMS_UPDATED") {
    const status = data.lineItemPaymentStatus || data.status;

    if (status === "CANCELLED" || status === "RETURNED") {
      const sku = data.sku;
      const qty = Number(data.quantity) || 1;

      if (!sku) return { processed: false };

      if (!orderId) {
        logger.warn("[ebay.webhook] ORDER.LINE_ITEMS_UPDATED has no orderId or notificationId — skipping to avoid double restock");
        return { processed: false };
      }

      const claimed = await claimEvent(orderId, "restock");
      if (!claimed) {
        logger.info(`[ebay.webhook] Order ${orderId} restock already recorded — skipping`);
        return { processed: false, reason: "already_processed" };
      }

      await adjustStockBySku(sku, qty);

      await EbayProcessedOrder.updateOne(
        { platform: MARKETPLACE_PLATFORM.EBAY, orderId, action: "restock" },
        { $set: { lineItems: [{ sku, quantity: qty }] } },
      );

      logger.info(`[ebay.webhook] Restored ${qty} × ${sku} for order ${orderId} (${status})`);
      return { processed: true, topic, sku, qty };
    }

    return { processed: false, topic, reason: "status not a cancellation" };
  }

  logger.info(`[ebay.webhook] Ignored topic: ${topic}`);
  return { processed: false, topic, reason: "unhandled topic" };
}

async function subscribeToTopics(endpointUrl, verificationToken) {
  const token = await getAppToken();
  const results = [];

  for (const topicId of TOPICS) {
    const res = await fetch(`${EBAY_NOTIFICATION_API}/subscription`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_AU",
      },
      body: JSON.stringify({
        topicId,
        deliveryConfig: {
          endpoint: endpointUrl,
          verificationToken,
        },
      }),
    });

    const body = await res.json().catch(() => ({}));
    results.push({ topicId, status: res.status, body });
  }

  return results;
}

module.exports = { verifyChallenge, verifySignature, processNotification, subscribeToTopics };
