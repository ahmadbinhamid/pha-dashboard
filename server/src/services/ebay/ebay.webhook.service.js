// services/ebay/ebay.webhook.service.js
//
// Multi-tenant: each tenant registers their OWN subscription, pointed at the
// one shared callback URL with their own opaque ?wt= token appended
// (/api/v1/ebay/webhook?wt=<webhook_token> — see ebay.routes.js), verified
// with their own EbaySettings.verification_token. The tenant is resolved
// from that token by the controller before any of these functions run, so
// nothing here has to guess whose notification this is.

const crypto = require("crypto");
const { getAppToken, apiBaseUrlFor } = require("./ebay.api.service");
const { adjustStockBySku } = require("../inventory.service");
const { updateEbayOrderStatus } = require("../order.service");
const EbayProcessedOrder = require("../../models/EbayProcessedOrder");
const { logger } = require("../../loaders/logging");
const { MARKETPLACE_PLATFORM } = require("../../constants/marketplace.constants");
const { ORDER_STATUS } = require("../../constants/order.constants");

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

async function processNotification(payload, tenant) {
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

    logger.info(`[ebay.webhook] tenant ${tenant._id}: deducted ${qty} × ${sku} for order ${orderId}`);
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

      // Isolated from the stock adjustment above: eBay never retries this
      // webhook (we already respond 200 before processNotification runs —
      // see ebay.controller.js), so a throw here would permanently skip
      // the bookkeeping update below with no chance to recover. The stock
      // correction is the critical side effect and has already committed.
      const localStatus = status === "CANCELLED" ? ORDER_STATUS.CANCELLED : ORDER_STATUS.REFUNDED;
      try {
        await updateEbayOrderStatus(orderId, { sku, quantity: qty, status: localStatus }, tenant._id);
      } catch (err) {
        logger.error(`[ebay.webhook] Failed to update order status for ${orderId}: ${err.message}`);
      }

      await EbayProcessedOrder.updateOne(
        { platform: MARKETPLACE_PLATFORM.EBAY, orderId, action: "restock" },
        { $set: { lineItems: [{ sku, quantity: qty }] } },
      );

      logger.info(`[ebay.webhook] tenant ${tenant._id}: restored ${qty} × ${sku} for order ${orderId} (${status}), order status → ${localStatus}`);
      return { processed: true, topic, sku, qty };
    }

    return { processed: false, topic, reason: "status not a cancellation" };
  }

  logger.info(`[ebay.webhook] Ignored topic: ${topic}`);
  return { processed: false, topic, reason: "unhandled topic" };
}

async function subscribeToTopics(endpointUrl, verificationToken, settings) {
  const token = await getAppToken(settings);
  const notificationApi = `${apiBaseUrlFor(settings.sandbox)}/commerce/notification/v1`;
  const results = [];

  for (const topicId of TOPICS) {
    const res = await fetch(`${notificationApi}/subscription`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-EBAY-C-MARKETPLACE-ID": settings.marketplace_id,
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
