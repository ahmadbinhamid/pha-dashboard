// services/ebay/ebay.service.js
//
// Three-step eBay Sell Inventory API flow:
//   1. createOrReplaceInventoryItem  (PUT  /sell/inventory/v1/inventory_item/{sku})
//   2. createOffer / updateOffer     (POST /sell/inventory/v1/offer  OR
//                                    PUT  /sell/inventory/v1/offer/{offerId})
//   3. publishOffer                  (POST /sell/inventory/v1/offer/{offerId}/publish)
//
// The offerId is persisted on the Product/ProductVariant so subsequent syncs
// update the existing offer rather than creating a new one.

const config = require("../../config");
const { logger } = require("../../loaders/logging");

const BASE_URL = config.ebay.sandbox
  ? "https://api.sandbox.ebay.com"
  : "https://api.ebay.com";

const TOKEN_ENDPOINT = `${BASE_URL}/identity/v1/oauth2/token`;
const INVENTORY_BASE = `${BASE_URL}/sell/inventory/v1`;

let _cachedToken = null;
let _tokenExpiry = 0;

// ── Auth ─────────────────────────────────────────────────────────────────────

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

function ebayHeaders(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Content-Language": "en-AU",
    "X-EBAY-C-MARKETPLACE-ID": config.ebay.marketplaceId,
    ...extra,
  };
}

async function loadSettings() {
  // Lazy-load to avoid circular dep at module load time
  const EbaySettings = require("../../models/EbaySettings");
  const db = (await EbaySettings.findOne().lean()) || {};
  // Fall back to env vars so the app works without a DB settings record
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
  return {
    sku,
    availability: {
      shipToLocationAvailability: { quantity },
    },
    condition: product.ebay_condition || "NEW",
    product: {
      title: product.title,
      description: product.description || product.title,
      imageUrls:
        product.attachments
          ?.filter((a) => a.url)
          .map((a) => a.url)
          .slice(0, 12) || [],
      ...(product.brand ? { brand: product.brand } : {}),
    },
  };
}

async function upsertInventoryItem(token, inventoryItem) {
  const { sku } = inventoryItem;
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
  // 204 No Content on success — no body to parse
  return { ok: true };
}

// ── Step 2: Offer ─────────────────────────────────────────────────────────────

function buildOffer(product, sku, settings) {
  const offer = {
    sku,
    marketplaceId: config.ebay.marketplaceId,
    format: "FIXED_PRICE",
    availableQuantity: 0,
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
  return offer;
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
  const res = await fetch(`${INVENTORY_BASE}/offer/${encodeURIComponent(offerId)}`, {
    method: "PUT",
    headers: ebayHeaders(token),
    body: JSON.stringify(offerBody),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`updateOffer failed: ${res.status} ${text}`);
  }
  return { ok: true };
}

// ── Step 3: Publish ────────────────────────────────────────────────────────────

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

// ── Main sync ─────────────────────────────────────────────────────────────────

async function syncProduct(productPlain, variants = []) {
  if (!credentialsConfigured()) {
    logger.warn("[eBay] syncProduct skipped — credentials not configured");
    return { skipped: true };
  }

  const token = await getAccessToken();
  if (!token) return { error: "Could not obtain access token" };

  // Load the fresh product from DB so we always have latest ebay_offer_id etc.
  const Product = require("../../models/Product");
  const ProductVariant = require("../../models/ProductVariant");

  const product = await Product.findById(productPlain._id).populate("attachments").lean();
  if (!product) return { error: "Product not found in DB" };

  const settings = await loadSettings();

  // Mark as pending
  await Product.findByIdAndUpdate(product._id, {
    ebay_sync_status: "pending",
  });

  const results = [];

  try {
    const itemsToSync =
      variants.length > 0
        ? variants.map((v) => ({
            sku: v.sku || `ph-${product._id}-${v._id}`,
            variantId: v._id,
            existingOfferId: v.ebay_offer_id || null,
          }))
        : [
            {
              sku: product.sku || `ph-${product._id}`,
              variantId: null,
              existingOfferId: product.ebay_offer_id || null,
            },
          ];

    for (const item of itemsToSync) {
      const { sku, variantId, existingOfferId } = item;

      try {
        // Step 1 — inventory item
        const inventoryItem = buildInventoryItem(product, sku);
        await upsertInventoryItem(token, inventoryItem);
        logger.info(`[eBay] inventory_item upserted: ${sku}`);

        // Steps 2+3 only when we have the required eBay category
        if (!product.ebay_category_id) {
          logger.warn(
            `[eBay] ${sku}: ebay_category_id missing — skipping offer/publish`,
          );
          results.push({ sku, ok: true, published: false, reason: "no_category" });
          continue;
        }

        const offerBody = buildOffer(product, sku, settings);

        let offerId = existingOfferId;

        if (offerId) {
          // Step 2a — update existing offer
          await updateOffer(token, offerId, offerBody);
          logger.info(`[eBay] offer updated: ${offerId}`);
        } else {
          // Step 2b — create new offer
          offerId = await createOffer(token, offerBody);
          logger.info(`[eBay] offer created: ${offerId}`);
        }

        // Step 3 — publish
        const listingId = await publishOffer(token, offerId);
        logger.info(`[eBay] offer published, listingId: ${listingId}`);

        // Persist offerId + listingId back to DB
        if (variantId) {
          await ProductVariant.findByIdAndUpdate(variantId, {
            ebay_offer_id: offerId,
            ebay_listing_id: listingId,
            ebay_sync_status: "synced",
          });
        } else {
          await Product.findByIdAndUpdate(product._id, {
            ebay_offer_id: offerId,
            ebay_listing_id: listingId,
            ebay_sync_status: "synced",
            ebay_synced_at: new Date(),
          });
        }

        results.push({ sku, ok: true, offerId, listingId });
      } catch (itemErr) {
        logger.error(`[eBay] sync failed for SKU ${sku}: ${itemErr.message}`);
        results.push({ sku, error: itemErr.message });

        if (!variantId) {
          await Product.findByIdAndUpdate(product._id, {
            ebay_sync_status: "error",
          });
        }
      }
    }

    // If all items for a variant product succeeded, mark product as synced
    const allOk = results.every((r) => r.ok);
    if (variants.length > 0) {
      await Product.findByIdAndUpdate(product._id, {
        ebay_sync_status: allOk ? "synced" : "error",
        ebay_synced_at: allOk ? new Date() : undefined,
      });
    }

    return { results };
  } catch (err) {
    logger.error(`[eBay] syncProduct error: ${err.message}`);
    await Product.findByIdAndUpdate(product._id, { ebay_sync_status: "error" });
    return { error: err.message };
  }
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
  syncProduct,
  updateInventoryQuantity,
  deleteProduct,
};
