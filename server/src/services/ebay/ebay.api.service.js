// services/ebay/ebay.api.service.js
// Pure eBay API communication layer — no database access, no orchestration

const config = require("../../config");
const { logger } = require("../../loaders/logging");

const BASE_URL = config.ebay.sandbox
  ? "https://api.sandbox.ebay.com"
  : "https://api.ebay.com";

const TOKEN_ENDPOINT = `${BASE_URL}/identity/v1/oauth2/token`;
const INVENTORY_BASE = `${BASE_URL}/sell/inventory/v1`;
const FULFILLMENT_BASE = `${BASE_URL}/sell/fulfillment/v1`;

let _cachedToken = null;
let _tokenExpiry = 0;

let _cachedAppToken = null;
let _appTokenExpiry = 0;

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

async function getAppToken() {
  const now = Date.now();
  if (_cachedAppToken && now < _appTokenExpiry - 30_000) return _cachedAppToken;

  if (!credentialsConfigured()) {
    logger.warn("[eBay] Credentials not configured — skipping notification token fetch");
    return null;
  }

  const credentials = Buffer.from(
    `${config.ebay.clientId}:${config.ebay.clientSecret}`,
  ).toString("base64");

  // Uses refresh_token grant so the notification scope rides on the seller's existing OAuth consent
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: config.ebay.refreshToken,
    scope: "https://api.ebay.com/oauth/api_scope/commerce.notification.subscription",
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
    logger.error(`[eBay] Notification token fetch failed: ${res.status} ${text}`);
    return null;
  }

  const data = await res.json();
  _cachedAppToken = data.access_token;
  _appTokenExpiry = now + (data.expires_in || 7200) * 1000;
  return _cachedAppToken;
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

// ── Resolved-based builders (used by EbayAdapter / MarketplaceListing path) ──

function resolveImageUrls(photos) {
  const uploadsUrl = process.env.UPLOADS_URL || "http://localhost:7000/uploads";
  const urls = (photos || [])
    .filter((a) => a && a.url)
    .map((a) => {
      if (a.url.startsWith("http")) return a.url;
      return `${uploadsUrl}${a.url.startsWith("/") ? "" : "/"}${a.url}`;
    })
    .filter((url) => url.startsWith("https://"))
    .slice(0, 12);
  return urls.length > 0
    ? urls
    : config.ebay.fallbackImageUrl
      ? [config.ebay.fallbackImageUrl]
      : [];
}

function buildInventoryItemFromResolved(resolved, quantity = 0) {
  const { sku, title, description, brand, photos, listing } = resolved;
  const imageUrls = resolveImageUrls(photos);
  const condition = listing.condition || "FOR_PARTS_OR_NOT_WORKING";

  // Map stored item_specifics to eBay aspect format
  const specs = listing.item_specifics || {};
  const aspects = {};
  if (brand || specs.brand) aspects["Brand"] = [specs.brand || brand];
  if (specs.mpn) aspects["Manufacturer Part Number"] = [specs.mpn];
  if (specs.superseded_part_number) aspects["Superseded Part Number"] = [specs.superseded_part_number];
  if (specs.placement_on_vehicle) aspects["Placement on Vehicle"] = [specs.placement_on_vehicle];
  if (specs.part_type) aspects["Part Type"] = [specs.part_type];
  if (specs.finish) aspects["Surface Finish"] = [specs.finish];
  if (specs.warranty) aspects["Warranty"] = [specs.warranty];

  return {
    sku,
    availability: { shipToLocationAvailability: { quantity } },
    condition,
    product: {
      title,
      description: description || title,
      imageUrls,
      ...(brand ? { brand } : {}),
      ...(Object.keys(aspects).length > 0 ? { aspects } : {}),
    },
  };
}

function buildOfferFromResolved(resolved, settings, quantity = 1) {
  const { sku, price, description, title, listing } = resolved;

  // Policy IDs: listing-level override ?? EbaySettings account default
  const fulfillmentPolicyId = listing.fulfillment_policy_id || settings.fulfillment_policy_id;
  const paymentPolicyId = listing.payment_policy_id || settings.payment_policy_id;
  const returnPolicyId = listing.return_policy_id || settings.return_policy_id;
  const merchantLocationKey = listing.merchant_location_key || settings.merchant_location_key;

  return {
    sku,
    marketplaceId: config.ebay.marketplaceId,
    format: listing.format || "FIXED_PRICE",
    availableQuantity: quantity,
    ...(listing.ebay_category_id ? { categoryId: listing.ebay_category_id } : {}),
    listingDescription: description || title,
    pricingSummary: {
      price: { value: String(price || 0), currency: "AUD" },
    },
    listingPolicies: {
      ...(fulfillmentPolicyId ? { fulfillmentPolicyId } : {}),
      ...(paymentPolicyId ? { paymentPolicyId } : {}),
      ...(returnPolicyId ? { returnPolicyId } : {}),
    },
    ...(merchantLocationKey ? { merchantLocationKey } : {}),
  };
}

// ── Step 2: Offer ─────────────────────────────────────────────────────────────

function buildOffer(product, sku, settings, quantity = 1) {
  return {
    sku,
    marketplaceId: config.ebay.marketplaceId,
    format: "FIXED_PRICE",
    availableQuantity: quantity,
    ...(product.ebay_category_id ? { categoryId: product.ebay_category_id } : {}),
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

async function deleteProduct(sku, offerId = null) {
  if (!credentialsConfigured()) {
    logger.warn("[eBay] deleteProduct skipped — credentials not configured");
    return { skipped: true };
  }

  const token = await getAccessToken();
  if (!token) return { error: "Could not obtain access token" };

  try {
    // Step 1 — withdraw the offer first (eBay blocks inventory item deletion while an offer exists)
    if (offerId) {
      const offerRes = await fetch(
        `${INVENTORY_BASE}/offer/${encodeURIComponent(offerId)}`,
        { method: "DELETE", headers: ebayHeaders(token) },
      );
      if (!offerRes.ok && offerRes.status !== 404) {
        const text = await offerRes.text();
        logger.error(`[eBay] deleteProduct withdraw offer ${offerId} failed: ${offerRes.status} ${text}`);
        return { error: `withdraw offer failed: ${offerRes.status}: ${text}` };
      }
      logger.info(`[eBay] offer withdrawn: ${offerId}`);
    }

    // Step 2 — delete the inventory item
    const res = await fetch(
      `${INVENTORY_BASE}/inventory_item/${encodeURIComponent(sku)}`,
      { method: "DELETE", headers: ebayHeaders(token) },
    );

    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      logger.error(`[eBay] deleteProduct ${sku} failed: ${res.status} ${text}`);
      return { error: `${res.status}: ${text}` };
    }

    logger.info(`[eBay] inventory_item deleted: ${sku}`);
    return { ok: true };
  } catch (err) {
    logger.error(`[eBay] deleteProduct error: ${err.message}`);
    return { error: err.message };
  }
}

// ── Fulfillment / Orders ──────────────────────────────────────────────────────

async function getOrders({ limit = 50, offset = 0 } = {}) {
  const token = await getAccessToken();
  if (!token) return { orders: [] };

  const url = `${FULFILLMENT_BASE}/order?filter=orderfulfillmentstatus%3A%7BNOT_STARTED%7CIN_PROGRESS%7D&limit=${limit}&offset=${offset}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-EBAY-C-MARKETPLACE-ID": config.ebay.marketplaceId,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error(`[eBay] getOrders failed: ${res.status} ${text}`);
      return { orders: [] };
    }

    return res.json();
  } catch (err) {
    logger.error(`[eBay] getOrders error: ${err.message}`);
    return { orders: [] };
  }
}

module.exports = {
  credentialsConfigured,
  getAccessToken,
  getAppToken,
  getOrders,
  loadSettings,
  ebayHeaders,
  buildInventoryItem,
  buildInventoryItemFromResolved,
  upsertInventoryItem,
  buildOffer,
  buildOfferFromResolved,
  createOffer,
  updateOffer,
  publishOffer,
  updateInventoryQuantity,
  deleteProduct,
};
