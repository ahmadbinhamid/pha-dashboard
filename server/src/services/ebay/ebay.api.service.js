// services/ebay/ebay.api.service.js
// Pure eBay API communication layer — no database access, no orchestration
//
// Multi-tenant: app creds (client_id/secret) are shared; refresh_token, marketplace,
// sandbox, policies, warehouse address are per-tenant via `settings`; OAuth tokens cache per tenant_id.

const config = require("../../config");
const { logger } = require("../../loaders/logging");
const { EBAY_SCOPES, currencyForMarketplace } = require("../../constants/ebay.constants");

// eBay errors come as `{ errors: [{ errorId, ... }] }`; use `.message` for generic
// failures or `.hasErrorId(code)` to branch on a specific eBay error code.
class EbayApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "EbayApiError";
    this.status = status;
    this.errors = parseEbayErrorBody(body);
  }

  hasErrorId(code) {
    return this.errors.some((e) => e.errorId === code);
  }
}

// Error body should be JSON but isn't guaranteed (5xx/timeout can return HTML) — fall back to empty list.
function parseEbayErrorBody(body) {
  try {
    const parsed = JSON.parse(body);
    return Array.isArray(parsed.errors) ? parsed.errors : [];
  } catch {
    return [];
  }
}

async function throwEbayApiError(action, res) {
  const text = await res.text();
  throw new EbayApiError(`${action} failed: ${res.status} ${text}`, { status: res.status, body: text });
}

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

// ── Base URLs ────────────────────────────────────────────────────────────────
// EBAY_API_BASE_URL/EBAY_TAXONOMY_BASE_URL override globally when set (e.g. a proxy); else derived from tenant's `sandbox` flag.
function apiBaseUrlFor(sandbox) {
  return config.ebay.apiBaseUrl || (sandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com");
}
function taxonomyBaseUrlFor(sandbox) {
  return config.ebay.taxonomyBaseUrl || `${apiBaseUrlFor(sandbox)}/commerce/taxonomy/v1`;
}
function inventoryBaseFor(sandbox) {
  return `${apiBaseUrlFor(sandbox)}/sell/inventory/v1`;
}
function fulfillmentBaseFor(sandbox) {
  return `${apiBaseUrlFor(sandbox)}/sell/fulfillment/v1`;
}
function tokenEndpointFor(sandbox) {
  return `${apiBaseUrlFor(sandbox)}/identity/v1/oauth2/token`;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
// Token caches keyed by tenant_id — a global var would leak one tenant's token into another's calls.
const _tokenCache = new Map(); // tenantId -> { token, expiry }
const _appTokenCache = new Map(); // tenantId -> { token, expiry }

// Catalog/Taxonomy tokens use client_credentials (app-level, no seller consent) — safe to share globally.
let _cachedCatalogToken = null;
let _catalogTokenExpiry = 0;
let _cachedCategoryTreeId = null;

// Called after OAuth (re)connect so a stale token minted from the old refresh_token is never served from cache.
function clearTokenCache(tenantId) {
  const key = String(tenantId);
  _tokenCache.delete(key);
  _appTokenCache.delete(key);
}

function credentialsConfigured(settings) {
  return !!(config.ebay.clientId && config.ebay.clientSecret && settings?.refresh_token);
}

async function getAccessToken(settings) {
  if (!credentialsConfigured(settings)) {
    logger.warn("[eBay] Credentials not configured — skipping token fetch");
    return null;
  }

  const key = String(settings.tenant_id);
  const now = Date.now();
  const cached = _tokenCache.get(key);
  if (cached && now < cached.expiry - 30_000) return cached.token;

  const credentials = Buffer.from(`${config.ebay.clientId}:${config.ebay.clientSecret}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: settings.refresh_token,
    scope: `${EBAY_SCOPES.SELL_INVENTORY} ${EBAY_SCOPES.SELL_ACCOUNT} ${EBAY_SCOPES.SELL_FULFILLMENT}`,
  });

  const res = await fetch(tokenEndpointFor(settings.sandbox), {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error(`[eBay] Token fetch failed for tenant ${key}: ${res.status} ${text}`);
    return null;
  }

  const data = await res.json();
  _tokenCache.set(key, { token: data.access_token, expiry: now + (data.expires_in || 7200) * 1000 });
  return data.access_token;
}

async function getAppToken(settings) {
  const key = String(settings?.tenant_id);
  const now = Date.now();
  const cached = _appTokenCache.get(key);
  if (cached && now < cached.expiry - 30_000) return cached.token;

  if (!credentialsConfigured(settings)) {
    logger.warn("[eBay] Credentials not configured — skipping notification token fetch");
    return null;
  }

  const credentials = Buffer.from(`${config.ebay.clientId}:${config.ebay.clientSecret}`).toString("base64");

  // Uses refresh_token grant so the notification scope rides on the seller's existing OAuth consent
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: settings.refresh_token,
    scope: EBAY_SCOPES.NOTIFICATION_SUBSCRIPTION,
  });

  const res = await fetch(tokenEndpointFor(settings.sandbox), {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error(`[eBay] Notification token fetch failed for tenant ${key}: ${res.status} ${text}`);
    return null;
  }

  const data = await res.json();
  _appTokenCache.set(key, { token: data.access_token, expiry: now + (data.expires_in || 7200) * 1000 });
  return data.access_token;
}

// Taxonomy/Catalog app token (client_credentials), cached process-wide; always PRODUCTION creds+endpoint
// since eBay's sandbox taxonomy tree doesn't work — invalid_client here maps to a 502 (see getCategoryAspects).
async function getCatalogToken() {
  const now = Date.now();
  if (_cachedCatalogToken && now < _catalogTokenExpiry - 30_000) return _cachedCatalogToken;

  if (!config.ebay.clientId || !config.ebay.clientSecret) {
    logger.warn("[eBay] App credentials not configured — skipping catalog token fetch");
    return null;
  }

  const credentials = Buffer.from(`${config.ebay.clientId}:${config.ebay.clientSecret}`).toString("base64");

  const body = new URLSearchParams({ grant_type: "client_credentials", scope: EBAY_SCOPES.BASE });

  // Catalog/Taxonomy calls are never sandboxed per-tenant — always production creds/endpoint.
  const res = await fetch(tokenEndpointFor(false), {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    // Never log the Basic auth header or clientSecret — only the App ID and eBay's response body.
    let isInvalidClient = false;
    try {
      isInvalidClient = JSON.parse(text)?.error === "invalid_client";
    } catch {
      // Not JSON — fall through, treated as a generic failure below.
    }

    if (isInvalidClient) {
      logger.error(
        `[eBay] Catalog token fetch rejected (invalid_client) for App ID "${config.ebay.clientId}" — ` +
          "taxonomy/catalog calls require PRODUCTION eBay app keys (App ID + Cert ID) even when the " +
          "tenant itself is sandbox-connected. Check EBAY_CLIENT_ID/EBAY_CLIENT_SECRET are your app's " +
          "PRODUCTION keyset, not the Sandbox one.",
      );
      const err = new Error(
        "eBay rejected the configured app credentials (invalid_client). Catalog/taxonomy calls require " +
          "PRODUCTION eBay app keys (App ID + Cert ID), even for an otherwise sandbox-connected tenant.",
      );
      // Surfaces as a 502 (not bare 500) via systemfailure()'s err.status handling — see getCategoryAspects.
      err.status = 502;
      err.code = "EBAY_APP_CREDENTIALS_REJECTED";
      throw err;
    }

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

function ebayHeaders(token, marketplaceId, extra = {}) {
  const contentLanguage = MARKETPLACE_LANGUAGE[marketplaceId] || "en-US";
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Content-Language": contentLanguage,
    "Accept-Language": contentLanguage,
    "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
    ...extra,
  };
}

async function upsertInventoryItem(token, settings, inventoryItem) {
  const { sku } = inventoryItem;

  const imageUrls = inventoryItem.product?.imageUrls || [];
  if (!imageUrls.length) {
    throw new Error(
      "No HTTPS image URLs found. Add images to the listing's Photos section and ensure UPLOADS_URL in .env is set to your public HTTPS URL (e.g. https://yourdomain.com/uploads).",
    );
  }

  const res = await fetch(
    `${inventoryBaseFor(settings.sandbox)}/inventory_item/${encodeURIComponent(sku)}`,
    {
      method: "PUT",
      headers: ebayHeaders(token, settings.marketplace_id),
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

function resolveImageUrls(photos, settings) {
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

  // Sandbox/dev falls back to tenant's fallback image so sync can be tested without a public HTTPS server; production requires real images.
  if (settings?.sandbox && settings?.fallback_image_url) {
    if (allUrls.length > 0) {
      logger.warn(
        `[eBay] resolveImageUrls: ${allUrls.length} image(s) found but none are HTTPS — ` +
        `using fallback image for sandbox. In production set UPLOADS_URL to your public HTTPS URL.`,
      );
    }
    return [settings.fallback_image_url];
  }

  if (allUrls.length > 0) {
    logger.warn(
      `[eBay] resolveImageUrls: ${allUrls.length} image(s) found but none are HTTPS. ` +
      `Set UPLOADS_URL to your public HTTPS URL (e.g. https://yourdomain.com/uploads).`,
    );
  }

  return [];
}

// UI stores NEW/USED; USED maps to USED_EXCELLENT (3000, not USED_GOOD/5000) since 4000-6000 are eBay's
// media-only grades, invalid for most Motors parts categories — see CONDITION_FALLBACK_ORDER in ebay.adapter.js.
//
// Throws on a missing condition (naming the SKU) instead of silently defaulting to FOR_PARTS_OR_NOT_WORKING;
// caught by sync.service.js#syncListing's per-item try/catch like any other listing error.
function normalizeCondition(condition, sku = null) {
  if (!condition) {
    const err = new Error(`Item condition is required${sku ? ` for SKU ${sku}` : ""} — set a condition before publishing to eBay`);
    // Missing condition is a data problem, not a connection failure — status 400 so it never trips
    // the circuit breaker (see circuitBreaker.js#isTransportOrAuthFailure).
    err.status = 400;
    throw err;
  }
  if (condition === "USED") return "USED_EXCELLENT";
  return condition;
}

// Builds Make/Model/Series/Year aspects from the Product's own Vehicle field, never the listing's Fitment table.
//
// Fitment can hold several compatible vehicles, but eBay's aspects are single-value (errorId 25002 if
// >1 sent) — using fitment's first row + a blended year range silently substituted the wrong vehicle;
// see bug report "Incorrect Vehicle Fitment Mapping to eBay Item Specifics".
function buildVehicleAspects(product) {
  const vehicle = product?.vehicle;
  if (!vehicle || (!vehicle.make && !vehicle.model)) return {};

  const aspects = {};
  if (vehicle.make) aspects["Make"] = [String(vehicle.make).trim()];
  if (vehicle.model) aspects["Model"] = [String(vehicle.model).trim()];
  if (vehicle.model_code) aspects["Series"] = [String(vehicle.model_code).trim()];
  if (vehicle.year_from != null) {
    const yearTo = vehicle.year_to != null ? vehicle.year_to : vehicle.year_from;
    aspects["Year"] = [yearTo !== vehicle.year_from ? `${vehicle.year_from}-${yearTo}` : String(vehicle.year_from)];
  }
  return aspects;
}

function buildInventoryItemFromResolved(resolved, quantity = 0, conditionOverride = null, settings = null) {
  const { sku, title, description, brand, photos, listing, product } = resolved;
  const imageUrls = resolveImageUrls(photos, settings);
  const condition = conditionOverride || normalizeCondition(listing.condition, sku);

  // Resolve brand/mpn once; eBay requires them as a pair (error 25002), so default the missing side.
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
  // Same errorId-25002 class as buildVehicleAspects: SPN is single-value on eBay though our data model
  // allows several, so only the first entry is sent (rest still show on our own product page).
  if (spnArr.length > 0) aspects["Superseded Part Number"] = [spnArr[0]];
  // Dedicated authenticity / warranty fields (override dynamic aspects of same name)
  if (specs.authenticity) aspects["Authenticity"] = [String(specs.authenticity)];
  if (specs.warranty) aspects["Warranty"] = [String(specs.warranty)];

  // Make/Model/Series/Year from product's vehicle field — see buildVehicleAspects for why fitment is ignored.
  const vehicleAspects = buildVehicleAspects(product);
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
    // null quantity = stock untracked (Product.stock_control false, see ebay.adapter.js#resolveQuantity);
    // omit availability so eBay's own quantity isn't overwritten with a guess.
    ...(quantity != null ? { availability: { shipToLocationAvailability: { quantity } } } : {}),
    condition,
    ...(packageWeightAndSize ? { packageWeightAndSize } : {}),
    product: {
      title,
      // product.description is plain-text, max 4000 chars; full HTML description lives in offer's listingDescription.
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

  // Policy IDs: listing-level override ?? this tenant's EbaySettings default
  const fulfillmentPolicyId = listing.fulfillment_policy_id || settings.fulfillment_policy_id;
  const paymentPolicyId = listing.payment_policy_id || settings.payment_policy_id;
  const returnPolicyId = listing.return_policy_id || settings.return_policy_id;
  const merchantLocationKey = listing.merchant_location_key || settings.merchant_location_key;

  // Was hardcoded "AUD" regardless of tenant marketplace, so non-AU tenants published in the wrong currency — found live.
  const currency = currencyForMarketplace(settings.marketplace_id);

  // require_immediate_payment isn't settable per-offer — it's governed by the payment policy in Seller Hub, so it's not forwarded here.

  return {
    sku,
    marketplaceId: settings.marketplace_id,
    format: listing.format || "FIXED_PRICE",
    // See buildInventoryItemFromResolved — null means don't touch eBay's quantity for untracked stock.
    ...(quantity != null ? { availableQuantity: quantity } : {}),
    ...(listing.ebay_category_id ? { categoryId: listing.ebay_category_id } : {}),
    listingDescription: description || title,
    pricingSummary: {
      price: { value: String(price || 0), currency },
    },
    listingPolicies: {
      ...(fulfillmentPolicyId ? { fulfillmentPolicyId } : {}),
      ...(paymentPolicyId ? { paymentPolicyId } : {}),
      ...(returnPolicyId ? { returnPolicyId } : {}),
      ...(listing.accept_best_offer ? {
        bestOfferTerms: {
          bestOfferEnabled: true,
          ...(listing.min_best_offer != null ? {
            autoDeclinePrice: { value: String(listing.min_best_offer), currency },
          } : {}),
        },
      } : {}),
    },
    ...(merchantLocationKey ? { merchantLocationKey } : {}),
  };
}

async function createOffer(token, settings, offerBody) {
  const res = await fetch(`${inventoryBaseFor(settings.sandbox)}/offer`, {
    method: "POST",
    headers: ebayHeaders(token, settings.marketplace_id),
    body: JSON.stringify(offerBody),
  });

  if (!res.ok) await throwEbayApiError("createOffer", res);

  const data = await res.json();
  return data.offerId;
}

async function updateOffer(token, settings, offerId, offerBody) {
  const res = await fetch(
    `${inventoryBaseFor(settings.sandbox)}/offer/${encodeURIComponent(offerId)}`,
    {
      method: "PUT",
      headers: ebayHeaders(token, settings.marketplace_id),
      body: JSON.stringify(offerBody),
    },
  );

  if (!res.ok) await throwEbayApiError("updateOffer", res);
  return { ok: true };
}

// ── Step 3: Publish ───────────────────────────────────────────────────────────

async function publishOffer(token, settings, offerId) {
  const res = await fetch(
    `${inventoryBaseFor(settings.sandbox)}/offer/${encodeURIComponent(offerId)}/publish`,
    {
      method: "POST",
      headers: ebayHeaders(token, settings.marketplace_id),
      body: JSON.stringify({}),
    },
  );

  if (!res.ok) await throwEbayApiError("publishOffer", res);

  const data = await res.json();
  return data.listingId;
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function deleteProduct(settings, sku, offerId = null) {
  if (!credentialsConfigured(settings)) {
    logger.warn("[eBay] deleteProduct skipped — credentials not configured");
    return { skipped: true };
  }

  const token = await getAccessToken(settings);
  if (!token) return { error: "Could not obtain access token" };

  try {
    // Step 1 — withdraw the offer first (eBay blocks inventory item deletion while an offer exists)
    if (offerId) {
      const offerRes = await fetch(
        `${inventoryBaseFor(settings.sandbox)}/offer/${encodeURIComponent(offerId)}`,
        { method: "DELETE", headers: ebayHeaders(token, settings.marketplace_id) },
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
      `${inventoryBaseFor(settings.sandbox)}/inventory_item/${encodeURIComponent(sku)}`,
      { method: "DELETE", headers: ebayHeaders(token, settings.marketplace_id) },
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

// Lists tenant's eBay merchant locations, used post-OAuth to auto-fill merchant_location_key instead of manual entry.
async function getInventoryLocations(token, settings) {
  const res = await fetch(
    `${inventoryBaseFor(settings.sandbox)}/location?limit=100`,
    { headers: ebayHeaders(token, settings.marketplace_id) },
  );

  if (!res.ok) await throwEbayApiError("getInventoryLocations", res);

  const body = await res.json();
  return body.locations || [];
}

async function ensureLocation(token, settings) {
  const key = settings.merchant_location_key;
  if (!key) throw new Error("This tenant has no merchant_location_key set — configure it in eBay settings first");

  const checkRes = await fetch(
    `${inventoryBaseFor(settings.sandbox)}/location/${encodeURIComponent(key)}`,
    { headers: ebayHeaders(token, settings.marketplace_id) },
  );

  if (checkRes.ok) {
    logger.debug(`[eBay] merchant location "${key}" already exists`);
    return;
  }

  if (checkRes.status !== 404) {
    const text = await checkRes.text();
    throw new Error(`GET location/${key} failed: ${checkRes.status} ${text}`);
  }

  // Location doesn't exist — build from this tenant's warehouse address
  const missing = [];
  if (!settings.warehouse_street) missing.push("warehouse_street");
  if (!settings.warehouse_city) missing.push("warehouse_city");
  if (!settings.warehouse_state) missing.push("warehouse_state");
  if (!settings.warehouse_postcode) missing.push("warehouse_postcode");

  if (missing.length) {
    throw new Error(
      `Merchant location "${key}" does not exist on eBay and cannot be auto-created. ` +
      `Set these fields in this tenant's eBay settings: ${missing.join(", ")}`,
    );
  }

  const body = {
    location: {
      address: {
        addressLine1: settings.warehouse_street,
        city: settings.warehouse_city,
        stateOrProvince: settings.warehouse_state,
        postalCode: settings.warehouse_postcode,
        country: settings.warehouse_country,
      },
    },
    locationTypes: ["WAREHOUSE"],
    name: key,
    merchantLocationStatus: "ENABLED",
    ...(settings.warehouse_phone ? { phone: settings.warehouse_phone } : {}),
  };

  const createRes = await fetch(
    `${inventoryBaseFor(settings.sandbox)}/location/${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: ebayHeaders(token, settings.marketplace_id),
      body: JSON.stringify(body),
    },
  );

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Create merchant location "${key}" failed: ${createRes.status} ${text}`);
  }

  logger.info(`[eBay] merchant location created: "${key}" (${settings.warehouse_city}, ${settings.warehouse_state})`);
}

// ── Fulfillment / Orders ──────────────────────────────────────────────────────

async function getOrders(settings, { limit = 50, offset = 0 } = {}) {
  const token = await getAccessToken(settings);
  if (!token) throw new Error("[eBay] getOrders: could not obtain access token");

  const url = `${fulfillmentBaseFor(settings.sandbox)}/order?filter=orderfulfillmentstatus%3A%7BNOT_STARTED%7CIN_PROGRESS%7D&limit=${limit}&offset=${offset}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-EBAY-C-MARKETPLACE-ID": settings.marketplace_id,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    // Thrown (not swallowed) so an auth/scope failure surfaces as a failed job, not silently "no new orders".
    throw new Error(`[eBay] getOrders failed: ${res.status} ${text}`);
  }

  return res.json();
}

// getOrders only fetches one page; this walks all pages via eBay's `total` (capped at MAX_ORDER_PAGES)
// so a backlog over 50 open orders isn't silently dropped (same concern as getAllInventoryItems below).
const MAX_ORDER_PAGES = 100; // 100 * 200 = 20,000 open orders — generous ceiling
async function getAllOpenOrders(settings, { pageSize = 200 } = {}) {
  const orders = [];
  let offset = 0;

  for (let page = 0; page < MAX_ORDER_PAGES; page++) {
    const data = await getOrders(settings, { limit: pageSize, offset });
    const batch = data.orders || [];
    orders.push(...batch);

    const total = typeof data.total === "number" ? data.total : orders.length;
    offset += pageSize;
    if (orders.length >= total || batch.length < pageSize) break;
  }

  return orders;
}

// Paginated bulk-fetch of every inventory item (for the sync poller's diff, avoids one GET per SKU);
// MAX_INVENTORY_PAGES bounds what used to be an unbounded while(true) loop — now fails loudly instead of spinning forever.
const MAX_INVENTORY_PAGES = 500; // 500 * 100 = 50,000 items — generous ceiling
// Returns { items, complete }; complete:false means a page came back short of eBay's reported total
// (transient hiccup, not proof SKUs are gone) — callers (see handleMissingFromEbay) must skip
// delete-if-missing decisions that cycle, or risk deleting a still-live listing (a real past incident).
async function getAllInventoryItems(settings, { pageSize = 100 } = {}) {
  const token = await getAccessToken(settings);
  if (!token) throw new Error("[eBay] getAllInventoryItems: could not obtain access token");

  const items = [];
  let offset = 0;
  let reportedTotal = null;

  for (let page = 0; page < MAX_INVENTORY_PAGES; page++) {
    const res = await fetch(
      `${inventoryBaseFor(settings.sandbox)}/inventory_item?limit=${pageSize}&offset=${offset}`,
      { headers: ebayHeaders(token, settings.marketplace_id) },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[eBay] getAllInventoryItems failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    const batch = data.inventoryItems || [];
    if (typeof data.total === "number") reportedTotal = data.total;
    items.push(...batch);

    if (batch.length < pageSize) {
      const complete = reportedTotal == null || items.length >= reportedTotal;
      return { items, complete };
    }
    offset += pageSize;
  }

  throw new Error(
    `[eBay] getAllInventoryItems: exceeded ${MAX_INVENTORY_PAGES} pages (${MAX_INVENTORY_PAGES * pageSize} items) — aborting, offset pagination may not be terminating`,
  );
}

// ── Taxonomy ──────────────────────────────────────────────────────────────────
// Not tenant-scoped — client_credentials app token, same category tree
// regardless of which tenant is asking (categories are eBay-marketplace-wide,
// not seller-specific). marketplaceId still matters (different sites have
// different trees), so it's passed explicitly rather than pulled from a
// per-tenant settings object.

async function getDefaultCategoryTreeId(marketplaceId = "EBAY_AU") {
  if (_cachedCategoryTreeId) return _cachedCategoryTreeId;

  const token = await getCatalogToken();
  const res = await fetch(
    `${taxonomyBaseUrlFor(false)}/get_default_category_tree_id?marketplace_id=${marketplaceId}`,
    { headers: ebayHeaders(token, marketplaceId) },
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

async function getItemAspectsForCategory(categoryId, marketplaceId = "EBAY_AU") {
  const token = await getCatalogToken();
  const treeId = await getDefaultCategoryTreeId(marketplaceId);
  const res = await fetch(
    `${taxonomyBaseUrlFor(false)}/category_tree/${treeId}/get_item_aspects_for_category?category_id=${categoryId}`,
    { headers: ebayHeaders(token, marketplaceId) },
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
  EbayApiError,
  credentialsConfigured,
  getAccessToken,
  getAppToken,
  getCatalogToken,
  tokenEndpointFor,
  clearTokenCache,
  getOrders,
  getAllOpenOrders,
  getAllInventoryItems,
  ebayHeaders,
  apiBaseUrlFor,
  inventoryBaseFor,
  buildInventoryItemFromResolved,
  normalizeCondition,
  upsertInventoryItem,
  buildOfferFromResolved,
  createOffer,
  updateOffer,
  publishOffer,
  deleteProduct,
  getInventoryLocations,
  ensureLocation,
  getDefaultCategoryTreeId,
  getItemAspectsForCategory,
};
