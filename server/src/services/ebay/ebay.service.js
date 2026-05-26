// services/ebay/ebay.service.js

const config = require("../../config");
const { logger } = require("../../loaders/logging");

const BASE_URL = config.ebay.sandbox
  ? "https://api.sandbox.ebay.com"
  : "https://api.ebay.com";

const TOKEN_ENDPOINT = `${BASE_URL}/identity/v1/oauth2/token`;
const INVENTORY_BASE = `${BASE_URL}/sell/inventory/v1`;

let _cachedToken = null;
let _tokenExpiry = 0;

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

function mapProductToInventoryItem(product, variantSku = null) {
  const sku = variantSku || product.sku || `ph-${product._id}`;
  return {
    sku,
    availability: {
      shipToLocationAvailability: {
        quantity: 0, // will be updated separately
      },
    },
    condition: "NEW",
    product: {
      title: product.title,
      description: product.description || product.title,
      imageUrls:
        product.attachments
          ?.filter((a) => a.url)
          .map((a) => a.url)
          .slice(0, 12) || [],
    },
  };
}

async function syncProduct(product, variants = []) {
  if (!credentialsConfigured()) {
    logger.warn("[eBay] syncProduct skipped — credentials not configured");
    return { skipped: true };
  }

  const token = await getAccessToken();
  if (!token) return { error: "Could not obtain access token" };

  try {
    const itemsToSync =
      variants.length > 0
        ? variants.map((v) => {
            const sku = v.sku || `ph-${product._id}-${v._id}`;
            return mapProductToInventoryItem(product, sku);
          })
        : [mapProductToInventoryItem(product)];

    const results = [];

    for (const item of itemsToSync) {
      const res = await fetch(
        `${INVENTORY_BASE}/inventory_item/${encodeURIComponent(item.sku)}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Content-Language": "en-AU",
            "X-EBAY-C-MARKETPLACE-ID": config.ebay.marketplaceId,
          },
          body: JSON.stringify(item),
        },
      );

      if (!res.ok) {
        const text = await res.text();
        logger.error(
          `[eBay] upsert inventory_item ${item.sku} failed: ${res.status} ${text}`,
        );
        results.push({ sku: item.sku, error: `${res.status}: ${text}` });
      } else {
        results.push({ sku: item.sku, ok: true });
      }
    }

    return { results };
  } catch (err) {
    logger.error(`[eBay] syncProduct error: ${err.message}`);
    return { error: err.message };
  }
}

async function updateInventoryQuantity(sku, quantity) {
  if (!credentialsConfigured()) {
    logger.warn(
      "[eBay] updateInventoryQuantity skipped — credentials not configured",
    );
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
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-EBAY-C-MARKETPLACE-ID": config.ebay.marketplaceId,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error(
        `[eBay] updateInventoryQuantity ${sku} failed: ${res.status} ${text}`,
      );
      return { error: `${res.status}: ${text}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    logger.error(`[eBay] updateInventoryQuantity error: ${err.message}`);
    return { error: err.message };
  }
}

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
  getAccessToken,
  syncProduct,
  updateInventoryQuantity,
  deleteProduct,
};
