// services/ebay/ebay.api.service.js
// Pure eBay API communication layer — no database access, no orchestration

const config = require("../../config");
const { logger } = require("../../loaders/logging");

const BASE_URL = config.ebay.sandbox
  ? "https://api.sandbox.ebay.com"
  : "https://api.ebay.com";

const TOKEN_ENDPOINT = `${BASE_URL}/identity/v1/oauth2/token`;
const INVENTORY_BASE = `${BASE_URL}/sell/inventory/v1`;

let _cachedToken = null;
let _tokenExpiry = 0;

// ── Auth ──────────────────────────────────────────────────────────────────────

function credentialsConfigured() {
  return !!(
    config.ebay.clientId &&
    config.ebay.clientSecret &&
    config.ebay.refreshToken
  );
}

async function getAccessToken() {
  if (!credentialsConfigured()) {
    logger.warn("[eBay] Credentials not configured — skipping token fetch");
    return null;
  }

  const now = Date.now();
  if (_cachedToken && now < _tokenExpiry - 30_000) {
    return _cachedToken;
  }

  const credentials = Buffer.from(
    `${config.ebay.clientId}:${config.ebay.clientSecret}`,
  ).toString("base64");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: config.ebay.refreshToken,
    scope:
      "https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account",
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error(`[eBay] Token fetch failed: ${res.status} ${text}`);
    return null;
  }

  const data = await res.json();
  _cachedToken = data.access_token;
  _tokenExpiry = now + (data.expires_in || 7200) * 1000;
  return _cachedToken;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MARKETPLACE_LANGUAGE = {
  EBAY_US: "en-US",
  EBAY_AU: "en-AU",
  EBAY_GB: "en-GB",
  EBAY_DE: "de-DE",
  EBAY_FR: "fr-FR",
};

function ebayHeaders(token, extra = {}) {
  const contentLanguage =
    MARKETPLACE_LANGUAGE[config.ebay.marketplaceId] || "en-US";
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Content-Language": contentLanguage,
    "Accept-Language": contentLanguage,
    "X-EBAY-C-MARKETPLACE-ID": config.ebay.marketplaceId,
    ...extra,
  };
}

async function loadSettings() {
  // Lazy-load to avoid circular dep at module load time
  const EbaySettings = require("../../models/EbaySettings");
  const db = (await EbaySettings.findOne().lean()) || {};
  return {
    merchant_location_key:
      db.merchant_location_key || config.ebay.merchantLocationKey || null,
    fulfillment_policy_id:
      db.fulfillment_policy_id || config.ebay.fulfillmentPolicyId || null,
    payment_policy_id:
      db.payment_policy_id || config.ebay.paymentPolicyId || null,
    return_policy_id:
      db.return_policy_id || config.ebay.returnPolicyId || null,
  };
}

// ── Step 1: Inventory Item ────────────────────────────────────────────────────

function buildInventoryItem(product, sku, quantity = 0) {
  const uploadsUrl = process.env.UPLOADS_URL || "http://localhost:7000/uploads";

  const imageUrls = (product.attachments || [])
    .filter((a) => a.url)
    .map((a) => {
      if (a.url.startsWith("http")) return a.url;
      return `${uploadsUrl}${a.url.startsWith("/") ? "" : "/"}${a.url}`;
    })
    .filter((url) => url.startsWith("https://"))
    .slice(0, 12);

  const finalImageUrls =
    imageUrls.length > 0
      ? imageUrls
      : config.ebay.fallbackImageUrl
        ? [config.ebay.fallbackImageUrl]
        : [];

  return {
    sku,
    availability: {
      shipToLocationAvailability: { quantity },
    },
    condition: product.ebay_condition || "FOR_PARTS_OR_NOT_WORKING",
    product: {
      title: product.title,
      description: product.description || product.title,
      imageUrls: finalImageUrls,
      ...(product.brand ? { brand: product.brand } : {}),
    },
  };
}

async function upsertInventoryItem(token, inventoryItem) {
  const { sku } = inventoryItem;

  const imageUrls = inventoryItem.product?.imageUrls || [];
  if (!imageUrls.length) {
    throw new Error(
      "No valid image URLs for eBay. Set EBAY_FALLBACK_IMAGE_URL in .env or upload a product image with a public HTTPS URL.",
    );
  }

  const res = await fetch(
    `${INVENTORY_BASE}/inventory_item/${encodeURIComponent(sku)}`,
    {
      method: "PUT",
      headers: ebayHeaders(token),
      body: JSON.stringify(inventoryItem),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`upsert inventory_item failed: ${res.status} ${text}`);
  }
  return { ok: true };
}

// ── Step 2: Offer ─────────────────────────────────────────────────────────────

function buildOffer(product, sku, settings, quantity = 1) {
  return {
    sku,
    marketplaceId: config.ebay.marketplaceId,
    format: "FIXED_PRICE",
    availableQuantity: quantity,
    categoryId: product.ebay_category_id,
    listingDescription: product.description || product.title,
    pricingSummary: {
      price: {
        value: String(product.price || 0),
        currency: "AUD",
      },
    },
    listingPolicies: {
      ...(settings.fulfillment_policy_id
        ? { fulfillmentPolicyId: settings.fulfillment_policy_id }
        : {}),
      ...(settings.payment_policy_id
        ? { paymentPolicyId: settings.payment_policy_id }
        : {}),
      ...(settings.return_policy_id
        ? { returnPolicyId: settings.return_policy_id }
        : {}),
    },
    ...(settings.merchant_location_key
      ? { merchantLocationKey: settings.merchant_location_key }
      : {}),
  };
}

async function createOffer(token, offerBody) {
  const res = await fetch(`${INVENTORY_BASE}/offer`, {
    method: "POST",
    headers: ebayHeaders(token),
    body: JSON.stringify(offerBody),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`createOffer failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.offerId;
}

async function updateOffer(token, offerId, offerBody) {
  const res = await fetch(
    `${INVENTORY_BASE}/offer/${encodeURIComponent(offerId)}`,
    {
      method: "PUT",
      headers: ebayHeaders(token),
      body: JSON.stringify(offerBody),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`updateOffer failed: ${res.status} ${text}`);
  }
  return { ok: true };
}

// ── Step 3: Publish ───────────────────────────────────────────────────────────

async function publishOffer(token, offerId) {
  const res = await fetch(
    `${INVENTORY_BASE}/offer/${encodeURIComponent(offerId)}/publish`,
    {
      method: "POST",
      headers: ebayHeaders(token),
      body: JSON.stringify({}),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`publishOffer failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.listingId;
}

// ── Inventory quantity update ─────────────────────────────────────────────────

async function updateInventoryQuantity(sku, quantity) {
  if (!credentialsConfigured()) {
    logger.warn("[eBay] updateInventoryQuantity skipped — credentials not configured");
    return { skipped: true };
  }

  const token = await getAccessToken();
  if (!token) return { error: "Could not obtain access token" };

  try {
    const body = {
      requests: [
        {
          sku,
          shipToLocationAvailability: { quantity },
        },
      ],
    };

    const res = await fetch(`${INVENTORY_BASE}/bulk_update_price_quantity`, {
      method: "POST",
      headers: ebayHeaders(token),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error(`[eBay] updateInventoryQuantity ${sku} failed: ${res.status} ${text}`);
      return { error: `${res.status}: ${text}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    logger.error(`[eBay] updateInventoryQuantity error: ${err.message}`);
    return { error: err.message };
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function deleteProduct(sku) {
  if (!credentialsConfigured()) {
    logger.warn("[eBay] deleteProduct skipped — credentials not configured");
    return { skipped: true };
  }

  const token = await getAccessToken();
  if (!token) return { error: "Could not obtain access token" };

  try {
    const res = await fetch(
      `${INVENTORY_BASE}/inventory_item/${encodeURIComponent(sku)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-EBAY-C-MARKETPLACE-ID": config.ebay.marketplaceId,
        },
      },
    );

    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      logger.error(`[eBay] deleteProduct ${sku} failed: ${res.status} ${text}`);
      return { error: `${res.status}: ${text}` };
    }

    return { ok: true };
  } catch (err) {
    logger.error(`[eBay] deleteProduct error: ${err.message}`);
    return { error: err.message };
  }
}

module.exports = {
  credentialsConfigured,
  getAccessToken,
  loadSettings,
  buildInventoryItem,
  upsertInventoryItem,
  buildOffer,
  createOffer,
  updateOffer,
  publishOffer,
  updateInventoryQuantity,
  deleteProduct,
};
