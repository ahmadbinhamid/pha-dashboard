// services/ebay/ebay.api.service.js
// Pure eBay API communication layer — no database access, no orchestration

const config = require("../../config");
const { logger } = require("../../loaders/logging");
const { EBAY_SCOPES } = require("../../constants/ebay.constants");

// Strip HTML tags and collapse whitespace for fields that only accept plain text
function toPlainText(html, maxLen = 4000) {
  return (html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

const BASE_URL = config.ebay.apiBaseUrl;
const TOKEN_ENDPOINT = `${BASE_URL}/identity/v1/oauth2/token`;
const INVENTORY_BASE = `${BASE_URL}/sell/inventory/v1`;
const FULFILLMENT_BASE = `${BASE_URL}/sell/fulfillment/v1`;

let _cachedToken = null;
let _tokenExpiry = 0;

let _cachedAppToken = null;
let _appTokenExpiry = 0;

let _cachedCatalogToken = null;
let _catalogTokenExpiry = 0;

let _cachedCategoryTreeId = null;

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
      `${EBAY_SCOPES.SELL_INVENTORY} ${EBAY_SCOPES.SELL_ACCOUNT} ${EBAY_SCOPES.SELL_FULFILLMENT}`,
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
    scope: EBAY_SCOPES.NOTIFICATION_SUBSCRIPTION,
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

// App token scoped for Taxonomy / Catalog APIs (client_credentials, base scope)
async function getCatalogToken() {
  const now = Date.now();
  if (_cachedCatalogToken && now < _catalogTokenExpiry - 30_000) return _cachedCatalogToken;

  if (!credentialsConfigured()) {
    logger.warn("[eBay] Credentials not configured — skipping catalog token fetch");
    return null;
  }

  const credentials = Buffer.from(
    `${config.ebay.clientId}:${config.ebay.clientSecret}`,
  ).toString("base64");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: EBAY_SCOPES.BASE,
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
    logger.error(`[eBay] Catalog token fetch failed: ${res.status} ${text}`);
    return null;
  }

  const data = await res.json();
  _cachedCatalogToken = data.access_token;
  _catalogTokenExpiry = now + (data.expires_in || 7200) * 1000;
  return _cachedCatalogToken;
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

async function upsertInventoryItem(token, inventoryItem) {
  const { sku } = inventoryItem;

  const imageUrls = inventoryItem.product?.imageUrls || [];
  if (!imageUrls.length) {
    throw new Error(
      "No HTTPS image URLs found. Add images to the listing's Photos section and ensure UPLOADS_URL in .env is set to your public HTTPS URL (e.g. https://yourdomain.com/uploads).",
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
  const uploadsUrl = config.uploads.url;
  const allUrls = (photos || [])
    .filter((a) => a && a.type === "image" && (a.url || a.file_name))
    .map((a) => {
      if (a.url && a.url.startsWith("http")) return a.url;
      const name = a.file_name;
      if (!name) return null;
      return `${uploadsUrl}/${name}`;
    })
    .filter(Boolean)
    .slice(0, 12);

  const httpsUrls = allUrls.filter((url) => url.startsWith("https://"));

  if (httpsUrls.length > 0) return httpsUrls;

  // In sandbox/dev, fall back to EBAY_FALLBACK_IMAGE_URL so the sync flow can
  // be tested without a public HTTPS upload server. Production requires real images.
  if (config.ebay.sandbox && config.ebay.fallbackImageUrl) {
    if (allUrls.length > 0) {
      logger.warn(
        `[eBay] resolveImageUrls: ${allUrls.length} image(s) found but none are HTTPS — ` +
        `using fallback image for sandbox. In production set UPLOADS_URL to your public HTTPS URL.`,
      );
    }
    return [config.ebay.fallbackImageUrl];
  }

  if (allUrls.length > 0) {
    logger.warn(
      `[eBay] resolveImageUrls: ${allUrls.length} image(s) found but none are HTTPS. ` +
      `Set UPLOADS_URL to your public HTTPS URL (e.g. https://yourdomain.com/uploads).`,
    );
  }

  return [];
}

// Our UI stores "NEW" or "USED". "NEW" is valid as-is; "USED" is not an eBay
// enum — map it to USED_GOOD as the safe default. Any other stored value is
// assumed to already be a valid eBay condition enum (for future granularity).
function normalizeCondition(condition) {
  if (!condition) return "FOR_PARTS_OR_NOT_WORKING";
  if (condition === "USED") return "USED_GOOD";
  return condition;
}

// Builds Make/Model/Series/Year aspects from the listing's vehicle fitment
// rows so custom-typed vehicle values (not just catalog ones) reach eBay as
// item specifics. Falls back to the product's own vehicle field when no
// fitment rows have been added yet (e.g. a listing just prefilled from a
// product).
//
// eBay's Make/Model/Series aspects are single-value (cardinality SINGLE) in
// motor-parts categories — sending more than one value is rejected with
// errorId 25002 ("Model should contain only one value"). So only the first
// fitment row supplies Make/Model/Series; Year is still combined into a
// min-max range across all rows, since that's already a single string value.
function buildVehicleAspects(listing, product) {
  const fitmentRows = Array.isArray(listing.fitment) ? listing.fitment : [];
  const rows = fitmentRows.length > 0
    ? fitmentRows
    : product?.vehicle && (product.vehicle.make || product.vehicle.model)
      ? [product.vehicle]
      : [];

  if (rows.length === 0) return {};

  const primary = rows[0];
  let minYear = null;
  let maxYear = null;

  for (const row of rows) {
    if (row?.year_from != null) {
      minYear = minYear == null ? row.year_from : Math.min(minYear, row.year_from);
    }
    const upperYear = row?.year_to != null ? row.year_to : row?.year_from;
    if (upperYear != null) {
      maxYear = maxYear == null ? upperYear : Math.max(maxYear, upperYear);
    }
  }

  const aspects = {};
  if (primary?.make) aspects["Make"] = [String(primary.make).trim()];
  if (primary?.model) aspects["Model"] = [String(primary.model).trim()];
  if (primary?.model_code) aspects["Series"] = [String(primary.model_code).trim()];
  if (minYear != null) {
    aspects["Year"] = [maxYear != null && maxYear !== minYear ? `${minYear}-${maxYear}` : String(minYear)];
  }
  return aspects;
}

function buildInventoryItemFromResolved(resolved, quantity = 0, conditionOverride = null) {
  const { sku, title, description, brand, photos, listing, product } = resolved;
  const imageUrls = resolveImageUrls(photos);
  const condition = conditionOverride || normalizeCondition(listing.condition);

  // Resolve brand/mpn once — used for both aspects and the product-level fields.
  // eBay validates Brand/MPN as a pair at the product level (error 25002 if one
  // is present without the other), so we default the missing side rather than
  // omitting one.
  const specs = listing.item_specifics || {};
  const resolvedBrand = (specs.brand || brand || "").trim();
  const resolvedMpn = (specs.mpn || "").trim();

  const hasBrand = !!resolvedBrand;
  const hasMpn = !!resolvedMpn;
  const productBrand = hasBrand ? resolvedBrand : hasMpn ? "Unbranded" : null;
  const productMpn = hasMpn ? resolvedMpn : hasBrand ? "Does Not Apply" : null;

  // Map stored item_specifics to eBay aspect format
  const aspects = {};
  if (productBrand) aspects["Brand"] = [productBrand];
  if (productMpn) aspects["Manufacturer Part Number"] = [productMpn];
  const rawSpn = specs.superseded_part_number;
  const spnArr = (Array.isArray(rawSpn) ? rawSpn : rawSpn != null ? [rawSpn] : [])
    .map((s) => (s == null ? "" : String(s).trim()))
    .filter((s) => s !== "" && s !== "null");
  if (spnArr.length > 0) aspects["Superseded Part Number"] = spnArr;
  // Dedicated authenticity / warranty fields (override dynamic aspects of same name)
  if (specs.authenticity) aspects["Authenticity"] = [String(specs.authenticity)];
  if (specs.warranty) aspects["Warranty"] = [String(specs.warranty)];

  // Make/Model/Series/Year from vehicle fitment (or the product's vehicle as fallback)
  const vehicleAspects = buildVehicleAspects(listing, product);
  for (const [name, value] of Object.entries(vehicleAspects)) {
    if (!aspects[name]) aspects[name] = value;
  }

  // Dynamic aspects from Taxonomy API (stored as Map on listing document)
  const dynamicAspects = specs.aspects instanceof Map
    ? Object.fromEntries(specs.aspects)
    : (typeof specs.aspects === "object" && specs.aspects !== null ? specs.aspects : {});
  for (const [name, value] of Object.entries(dynamicAspects)) {
    if (value && !aspects[name]) aspects[name] = [String(value)];
  }

  // packageWeightAndSize — only included when at least one dimension/weight is set
  const pkg = listing.package || {};
  const hasAnyDimension = pkg.length || pkg.width || pkg.height;
  const hasWeight = pkg.weight != null && String(pkg.weight).trim() !== "";
  const packageWeightAndSize =
    hasAnyDimension || hasWeight
      ? {
          ...(hasAnyDimension
            ? {
                dimensions: {
                  ...(pkg.length ? { length: Number(pkg.length) } : {}),
                  ...(pkg.width ? { width: Number(pkg.width) } : {}),
                  ...(pkg.height ? { height: Number(pkg.height) } : {}),
                  unit: "CENTIMETER",
                },
              }
            : {}),
          ...(hasWeight
            ? { weight: { value: Number(pkg.weight), unit: "KILOGRAM" } }
            : {}),
        }
      : null;

  return {
    sku,
    availability: { shipToLocationAvailability: { quantity } },
    condition,
    ...(packageWeightAndSize ? { packageWeightAndSize } : {}),
    product: {
      title,
      // Inventory API product.description is plain-text only, max 4000 chars.
      // The full HTML listing description lives in the offer's listingDescription.
      description: toPlainText(description || title) || title,
      imageUrls,
      // Brand and MPN must always be paired — eBay rejects one without the other (error 25002)
      ...(productBrand ? { brand: productBrand, mpn: productMpn } : {}),
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

  // require_immediate_payment cannot be set per-offer in the eBay Inventory API —
  // it is governed by the payment policy (paymentPolicyId). To enforce it, enable
  // "Require immediate payment" on the eBay payment policy itself via Seller Hub.
  // listing.require_immediate_payment is intentionally not forwarded here.

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
      ...(listing.accept_best_offer ? {
        bestOfferTerms: {
          bestOfferEnabled: true,
          ...(listing.min_best_offer != null ? {
            autoDeclinePrice: { value: String(listing.min_best_offer), currency: "AUD" },
          } : {}),
        },
      } : {}),
    },
    ...(merchantLocationKey ? { merchantLocationKey } : {}),
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

// ── Merchant Location ─────────────────────────────────────────────────────────

async function ensureLocation(token) {
  const key = config.ebay.merchantLocationKey;
  if (!key) throw new Error("EBAY_MERCHANT_LOCATION_KEY is not set — set it to the location key registered in eBay Seller Hub");

  const checkRes = await fetch(
    `${INVENTORY_BASE}/location/${encodeURIComponent(key)}`,
    { headers: ebayHeaders(token) },
  );

  if (checkRes.ok) {
    logger.debug(`[eBay] merchant location "${key}" already exists`);
    return;
  }

  if (checkRes.status !== 404) {
    const text = await checkRes.text();
    throw new Error(`GET location/${key} failed: ${checkRes.status} ${text}`);
  }

  // Location doesn't exist — build from env vars
  const { warehouseStreet, warehouseCity, warehouseState, warehousePostcode, warehouseCountry, warehousePhone } = config.ebay;
  const missing = [];
  if (!warehouseStreet) missing.push("EBAY_WAREHOUSE_STREET");
  if (!warehouseCity) missing.push("EBAY_WAREHOUSE_CITY");
  if (!warehouseState) missing.push("EBAY_WAREHOUSE_STATE");
  if (!warehousePostcode) missing.push("EBAY_WAREHOUSE_POSTCODE");

  if (missing.length) {
    throw new Error(
      `Merchant location "${key}" does not exist on eBay and cannot be auto-created. ` +
      `Set these env vars with your warehouse address: ${missing.join(", ")}`,
    );
  }

  const body = {
    location: {
      address: {
        addressLine1: warehouseStreet,
        city: warehouseCity,
        stateOrProvince: warehouseState,
        postalCode: warehousePostcode,
        country: warehouseCountry,
      },
    },
    locationTypes: ["WAREHOUSE"],
    name: key,
    merchantLocationStatus: "ENABLED",
    ...(warehousePhone ? { phone: warehousePhone } : {}),
  };

  const createRes = await fetch(
    `${INVENTORY_BASE}/location/${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: ebayHeaders(token),
      body: JSON.stringify(body),
    },
  );

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Create merchant location "${key}" failed: ${createRes.status} ${text}`);
  }

  logger.info(`[eBay] merchant location created: "${key}" (${warehouseCity}, ${warehouseState})`);
}

// ── Fulfillment / Orders ──────────────────────────────────────────────────────

async function getOrders({ limit = 50, offset = 0 } = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("[eBay] getOrders: could not obtain access token");

  const url = `${FULFILLMENT_BASE}/order?filter=orderfulfillmentstatus%3A%7BNOT_STARTED%7CIN_PROGRESS%7D&limit=${limit}&offset=${offset}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-EBAY-C-MARKETPLACE-ID": config.ebay.marketplaceId,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    // Thrown (not swallowed) so an auth/scope failure surfaces as a failed
    // Bull job instead of silently looking like "no new orders".
    throw new Error(`[eBay] getOrders failed: ${res.status} ${text}`);
  }

  return res.json();
}

// ── Taxonomy ──────────────────────────────────────────────────────────────────

const TAXONOMY_BASE = config.ebay.taxonomyBaseUrl;

async function getDefaultCategoryTreeId() {
  if (_cachedCategoryTreeId) return _cachedCategoryTreeId;

  const token = await getCatalogToken();
  const marketplaceId = config.ebay.marketplaceId;
  const res = await fetch(
    `${TAXONOMY_BASE}/get_default_category_tree_id?marketplace_id=${marketplaceId}`,
    { headers: ebayHeaders(token) },
  );
  if (!res.ok) {
    const text = await res.text();
    logger.error(`[eBay] getDefaultCategoryTreeId failed: ${res.status} ${text}`);
    throw new Error(`Failed to resolve eBay category tree: ${res.status}`);
  }
  const data = await res.json();
  _cachedCategoryTreeId = data.categoryTreeId;
  logger.debug(`[eBay] Category tree ID for ${marketplaceId}: ${_cachedCategoryTreeId}`);
  return _cachedCategoryTreeId;
}

async function getItemAspectsForCategory(categoryId) {
  const token = await getCatalogToken();
  const treeId = await getDefaultCategoryTreeId();
  const res = await fetch(
    `${TAXONOMY_BASE}/category_tree/${treeId}/get_item_aspects_for_category?category_id=${categoryId}`,
    { headers: ebayHeaders(token) },
  );
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 400) {
      logger.warn(`[eBay] getItemAspectsForCategory(${categoryId}) bad category ID: ${text}`);
      return [];
    }
    logger.error(`[eBay] getItemAspectsForCategory(${categoryId}) failed: ${res.status} ${text}`);
    throw new Error(`Failed to fetch category aspects: ${res.status}`);
  }
  const data = await res.json();
  const aspects = (data.aspects || []).map((a) => ({
    name: a.localizedAspectName,
    required: a.aspectConstraint?.aspectRequired === true,
    mode: a.aspectConstraint?.aspectMode || "FREE_TEXT",
    cardinality: a.aspectConstraint?.itemToAspectCardinality || "SINGLE",
    values: (a.aspectValues || []).map((v) => v.localizedValue),
  }));
  logger.info(`[eBay] Fetched ${aspects.length} aspects for category ${categoryId}`);
  return aspects;
}

module.exports = {
  credentialsConfigured,
  getAccessToken,
  getAppToken,
  getCatalogToken,
  getOrders,
  loadSettings,
  ebayHeaders,
  buildInventoryItemFromResolved,
  normalizeCondition,
  upsertInventoryItem,
  buildOfferFromResolved,
  createOffer,
  updateOffer,
  publishOffer,
  updateInventoryQuantity,
  deleteProduct,
  ensureLocation,
  getItemAspectsForCategory,
};
