// services/ebay/ebay.webhook.service.js

const crypto = require("crypto");
const { getAccessToken } = require("./ebay.api.service");
const { adjustStockBySku } = require("../inventory.service");
const { logger } = require("../../loaders/logging");

const EBAY_NOTIFICATION_API = "https://api.ebay.com/commerce/notification/v1";
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

async function processNotification(payload) {
  const topic = payload?.metadata?.topic;
  const data = payload?.notification?.data;

  if (!topic || !data) {
    logger.warn("[ebay.webhook] Missing topic or data in payload");
    return { processed: false };
  }

  if (topic === "ORDER.LINE_ITEMS_CREATED") {
    const sku = data.sku;
    const qty = data.quantity || 1;
    if (!sku) {
      logger.warn("[ebay.webhook] No SKU in ORDER.LINE_ITEMS_CREATED payload");
      return { processed: false };
    }
    await adjustStockBySku(sku, -qty);
    logger.info(`[ebay.webhook] Reduced stock by ${qty} for SKU: ${sku}`);
    return { processed: true, topic, sku, qty: -qty };
  }

  if (topic === "ORDER.LINE_ITEMS_UPDATED") {
    const status = data.lineItemPaymentStatus || data.status;
    if (status === "CANCELLED" || status === "RETURNED") {
      const sku = data.sku;
      const qty = data.quantity || 1;
      if (!sku) return { processed: false };
      await adjustStockBySku(sku, qty);
      logger.info(`[ebay.webhook] Restored stock by ${qty} for SKU: ${sku} (${status})`);
      return { processed: true, topic, sku, qty };
    }
    return { processed: false, topic, reason: "status not a cancellation" };
  }

  logger.info(`[ebay.webhook] Ignored topic: ${topic}`);
  return { processed: false, topic, reason: "unhandled topic" };
}

async function subscribeToTopics(endpointUrl, verificationToken) {
  const token = await getAccessToken();
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
