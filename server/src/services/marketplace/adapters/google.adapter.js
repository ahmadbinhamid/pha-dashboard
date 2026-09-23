// services/marketplace/adapters/google.adapter.js
// Marketplace adapter for Google Shopping (Merchant API); mirrors ebay.adapter.js's shape.
// Google is feed-shaped: publish()/update() are both just productInputs.insert (upsert).
// Pure translator: stock, product URL, identifiers and category arrive pre-resolved (see
// listing.resolver.js#hydrateResolved); end() gets its context from sync.service.js.
// Migrated v1beta -> v1 after v1beta's 2026-02-28 discontinuation; some ProductAttributes
// field names (price, condition, shippingLabel, etc.) are still unverified against a live call.

const { logger } = require("../../../loaders/logging");
const config = require("../../../config");
const { findConnection } = require("../channelConnection.service");
const googleOauthService = require("../../google/google.oauth.service");
const googleMerchantApi = require("../../google/google.merchant.api.service");
const { MARKETPLACE_PLATFORM } = require("../../../constants/marketplace.constants");
const { assertFieldValues } = require("../fieldSchema");
const { fieldSchema, fieldValues } = require("./google.fieldSchema");

// Google silently accepts a bad imageLink and only disapproves the product later (async);
// this guards against that like ebay.api.service.js#resolveImageUrls does. status 400 keeps
// circuitBreaker.js from tripping over a bad photo (a per-item data problem, not transport).
class GoogleImageValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "GoogleImageValidationError";
    this.status = 400;
    this.code = "INVALID_IMAGE_URL";
  }
}

// Stricter than a plain startsWith("https://") — an absolute-URL parse also catches a value
// that merely contains that prefix without actually being one.
function isAbsoluteHttpsUrl(url) {
  if (typeof url !== "string" || !url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

const key = MARKETPLACE_PLATFORM.GOOGLE;

const manifest = {
  key,
  name: "Google Shopping",
  logo: null,
  description: "Publish your catalogue to Google Shopping via the Merchant API.",
  status: "active",
  authType: "oauth",
  setupSteps: [
    "Connect your Google Merchant Center account via OAuth",
    "Confirm your feed label, content language, and target country",
    "A product data source is created automatically on connect",
  ],
  requiredTenantData: ["merchant_id", "feed_label", "content_language", "target_country"],
  // Merchant Center requires a claimed, verified website; a tenant with no verified default
  // Domain would get every product disapproved. Read by channel.service.js and google.controller.js.
  requiresStorefront: true,
  // Channel-only fields the product form's Google panel renders (see google.fieldSchema.js).
  fieldSchema,
};

const capabilities = {
  publish: true,
  inventory: true,
  batch: true,
  orders: false,
  webhooks: false,
  inboundInventory: false,
  variants: true,
};

// Listing field holding this channel's category; falls back to the tenant's CategoryMapping.
const categoryField = "google_product_category";

// I/O-backed data sync.service hydrates onto `resolved` before calling us.
const needs = { stock: true, productUrl: true };

// Google expires a product not refreshed within 30 days; defaults under that cap for headroom.
// Consumed by refresh.service.js / channel.worker.js.
const refreshIntervalDays = config.channels.refreshIntervalDays;

// Follows the generic registry.js contract (unlike eBay's non-generic loadSettings) — no
// ChannelConnection row returns null, and sync.service.js's "not connected" skip handles it.
async function loadSettings(tenantId) {
  return findConnection(tenantId, key, { withTokens: true });
}

function assertConfigured(settings) {
  if (!settings?.refresh_token_ct || !settings?.merchant_id || !settings?.data_source_id) {
    throw new Error(
      `[GoogleAdapter] Google Shopping is not fully configured for this tenant (missing refresh token, ` +
        `merchant_id, or data_source_id) — reconnect via Settings.`,
    );
  }
}

// v1 drops the channel segment: contentLanguage~feedLabel~offerId (v1beta had a leading channel~).
// Getting this wrong is silent — a wrong name 404s on delete, and end() treats 404 as success.
function buildProductResourceName(settings, sku) {
  return `${settings.content_language}~${settings.feed_label}~${sku}`;
}

// Full resource name needed by productInputs.delete, which addresses a product by its complete
// path, unlike insert (which takes the short name as `offerId`).
function buildFullProductResourceName(settings, sku) {
  return `accounts/${settings.merchant_id}/products/${buildProductResourceName(settings, sku)}`;
}

// v1's Availability is an ALL_CAPS enum (IN_STOCK/OUT_OF_STOCK/...), not the old Content API's
// lowercase strings — confirmed live after a real insert rejected "in stock" with 400.
function availabilityFor(quantity) {
  return quantity > 0 ? "IN_STOCK" : "OUT_OF_STOCK";
}

// gtin when present; otherwise mpn+brand when both present; otherwise identifierExists: false.
// Never invents an identifier. Logged at debug so the branch taken is traceable.
function applyIdentifiers(attributes, identifiers, sku) {
  if (identifiers.gtin) {
    // v1 renamed gtin -> gtins (now an array); this app only ever has one GTIN per listing.
    attributes.gtins = [identifiers.gtin];
    logger.debug(`[GoogleAdapter] ${sku}: identifier branch = gtin`);
    return;
  }
  if (identifiers.mpn && identifiers.brand) {
    attributes.mpn = identifiers.mpn;
    attributes.brand = identifiers.brand;
    logger.debug(`[GoogleAdapter] ${sku}: identifier branch = mpn+brand`);
    return;
  }
  attributes.identifierExists = false;
  logger.debug(`[GoogleAdapter] ${sku}: identifier branch = identifierExists:false (no gtin, no complete mpn+brand pair)`);
}

// Builds the full ProductInput resource body. `productUrl`/`identifiers` are resolved by the
// caller so this stays a pure, testable function with no DB access.
// Throws GoogleImageValidationError for any unusable or missing primary image — Google otherwise
// accepts a bad imageLink and disapproves the product later, asynchronously. A bad additional
// image is just dropped with a warning; the product can still list on its primary photo alone.
function buildProductInputFromResolved(resolved, settings, quantity, identifiers, productUrl) {
  const { sku, title, description, price, photos, listing, product } = resolved;
  // Effective category: listing value, else the tenant's mapping (listing.resolver.js).
  const googleProductCategory = resolved.category?.id || listing.google_product_category;

  const rawUrls = (photos || []).map((p) => (typeof p === "string" ? p : p?.url)).filter(Boolean);
  const primaryImageUrl = rawUrls[0] || null;

  if (!isAbsoluteHttpsUrl(primaryImageUrl)) {
    throw new GoogleImageValidationError(
      `[GoogleAdapter] ${sku}: primary image is not a usable public HTTPS URL` +
        (primaryImageUrl ? ` (got "${primaryImageUrl}")` : " (product has no images)") +
        " — Google Shopping requires a real, publicly reachable https:// image. Check UPLOADS_URL.",
    );
  }

  const additionalImageUrls = rawUrls.slice(1).filter((url) => {
    if (isAbsoluteHttpsUrl(url)) return true;
    logger.warn(`[GoogleAdapter] ${sku}: dropping non-HTTPS additional image URL ("${url}") — Google Shopping only accepts public HTTPS image URLs`);
    return false;
  });

  const attributes = {
    title,
    description,
    link: productUrl,
    imageLink: primaryImageUrl,
    ...(additionalImageUrls.length > 0 ? { additionalImageLinks: additionalImageUrls } : {}),
    availability: availabilityFor(quantity),
    condition: listing.condition || "new",
    price: {
      amountMicros: String(Math.round((price || 0) * 1_000_000)),
      currencyCode: settings.target_country ? currencyForCountry(settings.target_country) : "USD",
    },
    // Per-product shipping override, using the same Price shape as `price` above. Omitted (not
    // sent as 0) when unset, so it falls back to Google's account-level shipping rules rather than
    // claiming free shipping. maxHandlingTime/maxTransitTime left out — this app tracks neither.
    ...(product?.shipping_cost != null
      ? {
          shipping: [
            {
              country: settings.target_country || "AU",
              price: {
                amountMicros: String(Math.round(product.shipping_cost * 1_000_000)),
                currencyCode: settings.target_country ? currencyForCountry(settings.target_country) : "USD",
              },
            },
          ],
        }
      : {}),
    ...(googleProductCategory ? { googleProductCategory } : {}),
    ...(listing.shipping_label ? { shippingLabel: listing.shipping_label } : {}),
    ...(listing.custom_label_0 ? { customLabel0: listing.custom_label_0 } : {}),
    ...(listing.custom_label_1 ? { customLabel1: listing.custom_label_1 } : {}),
    ...(listing.custom_label_2 ? { customLabel2: listing.custom_label_2 } : {}),
    ...(listing.custom_label_3 ? { customLabel3: listing.custom_label_3 } : {}),
    ...(listing.custom_label_4 ? { customLabel4: listing.custom_label_4 } : {}),
  };

  applyIdentifiers(attributes, identifiers, sku);

  // v1 removed `channel` from ProductInput entirely; feedLabel/contentLanguage/offerId unchanged.
  return {
    contentLanguage: settings.content_language,
    feedLabel: settings.feed_label,
    offerId: sku,
    productAttributes: attributes,
  };
}

// No shared currency-per-country map exists to reuse; minimal fallback for realistic tenant countries.
const COUNTRY_CURRENCY = { AU: "AUD", US: "USD", GB: "GBP", NZ: "NZD", CA: "CAD" };
function currencyForCountry(countryCode) {
  return COUNTRY_CURRENCY[countryCode] || "USD";
}

// Server-side enforcement of every fieldSchema rule, on effective values.
function assertGoogleFields(resolved) {
  const categoryId = resolved.category?.id || resolved.listing.google_product_category;
  assertFieldValues(key, fieldSchema, fieldValues(resolved.listing, { categoryId }), { sku: resolved.sku });
}

// A product with stock_control off must never reach Google, not be published as in_stock —
// signaled back as `{ skipped, reason }`, additive to the normal adapter return contract.
function isUntrackedStock(resolved) {
  return resolved.product?.stock_control === false;
}

// Tracked-stock quantity from hydration; a batch-wide hydration failure surfaces here, per item.
function resolveQuantity(resolved) {
  if (resolved.hydrationError) throw resolved.hydrationError;
  if (!resolved.stock) throw new Error(`[GoogleAdapter] ${resolved.sku}: resolved.stock missing — hydrate via listing.resolver#hydrateResolved`);
  return resolved.stock.quantity;
}

// Throws the captured URL-resolution error at the same point the old inline lookup did.
function resolveProductUrl(resolved) {
  if (resolved.productUrlError) throw resolved.productUrlError;
  return resolved.productUrl;
}

async function publishOrUpdate(resolved, settings) {
  assertConfigured(settings);

  if (isUntrackedStock(resolved)) {
    logger.info(`[GoogleAdapter] ${resolved.sku}: stock_control is off — excluded from Google Shopping, not published as in_stock`);
    return { skipped: true, reason: "untracked_stock" };
  }

  assertGoogleFields(resolved);
  const quantity = resolveQuantity(resolved);
  // Throws if the tenant has no resolvable host or the product has no slug.
  const productUrl = resolveProductUrl(resolved);

  const token = await googleOauthService.getValidAccessToken(settings);
  if (!token) throw new Error(`[GoogleAdapter] ${resolved.sku}: could not obtain a valid Google access token`);

  const productInput = buildProductInputFromResolved(resolved, settings, quantity, resolved.identifiers, productUrl);
  await googleMerchantApi.insertProductInput(token, settings, productInput);
  logger.info(`[GoogleAdapter] product input upserted: ${resolved.sku} (qty: ${quantity}, availability: ${productInput.productAttributes.availability})`);

  return {
    external_listing_id: buildProductResourceName(settings, resolved.sku),
    external_offer_id: null,
    quantity,
  };
}

async function publish(resolved, _settings, _hooks, _seq) {
  return publishOrUpdate(resolved, _settings);
}

async function update(resolved, _settings, _hooks, _seq) {
  return publishOrUpdate(resolved, _settings);
}

// context comes from sync.service.js#endListing (product null when deleted/missing).
async function end(listing, { product, settings } = {}) {
  if (!listing.product) {
    logger.warn("[GoogleAdapter] end called with no resolvable product — nothing to withdraw");
    return;
  }
  if (!product) {
    logger.warn(`[GoogleAdapter] end: product not found for listing ${listing._id} — cannot resolve tenant, nothing to withdraw`);
    return;
  }
  if (!settings) {
    logger.warn(`[GoogleAdapter] end: tenant ${product.tenant_id} has no Google connection — nothing to withdraw`);
    return;
  }

  // NOTE: ignores the variant SKU, unlike publish (resolveSku) — pre-existing behaviour, kept
  // as-is; a variant listing may need its own SKU here (flagged, not silently changed).
  const sku = listing.store_sku || product.sku || `ph-${product._id}`;
  const token = await googleOauthService.getValidAccessToken(settings);
  if (!token) throw new Error(`[GoogleAdapter] end: could not obtain a valid Google access token for tenant ${product.tenant_id}`);

  await googleMerchantApi.deleteProductInput(token, settings, buildFullProductResourceName(settings, sku));
  logger.info(`[GoogleAdapter] listing ended: ${sku}`);
}

// Per-item calls under bounded concurrency (no documented Merchant API batch endpoint). Returns
// one result per input, in the same order, so sync.service.js#syncBatch can map results back.
const BATCH_CONCURRENCY = 10;

async function publishBatch(resolvedList, settings) {
  assertConfigured(settings);

  const token = await googleOauthService.getValidAccessToken(settings);
  if (!token) throw new Error("[GoogleAdapter] publishBatch: could not obtain a valid Google access token");

  const results = new Array(resolvedList.length);

  async function processOne(index) {
    const resolved = resolvedList[index];
    try {
      if (isUntrackedStock(resolved)) {
        logger.info(`[GoogleAdapter] ${resolved.sku}: stock_control is off — excluded from Google Shopping (batch)`);
        results[index] = { skipped: true, reason: "untracked_stock" };
        return;
      }

      assertGoogleFields(resolved);
      const quantity = resolveQuantity(resolved);
      const productUrl = resolveProductUrl(resolved);

      const productInput = buildProductInputFromResolved(resolved, settings, quantity, resolved.identifiers, productUrl);
      await googleMerchantApi.insertProductInput(token, settings, productInput);

      results[index] = {
        ok: true,
        external_listing_id: buildProductResourceName(settings, resolved.sku),
        external_offer_id: null,
        quantity,
      };
    } catch (err) {
      logger.warn(`[GoogleAdapter] batch item failed: ${resolved?.sku}: ${err.message}`);
      results[index] = { ok: false, error: err.message, status: err.status ?? null };
    }
  }

  // Hand-rolled worker pool over an index cursor — chunks are already small, no need for p-limit.
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < resolvedList.length) {
      const i = nextIndex++;
      await processOne(i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, resolvedList.length) }, () => worker()));

  return results;
}

module.exports = {
  key,
  manifest,
  capabilities,
  categoryField,
  needs,
  loadSettings,
  publish,
  update,
  end,
  publishBatch,
  refreshIntervalDays,
  // Exported for tests.
  buildProductInputFromResolved,
  buildProductResourceName,
  buildFullProductResourceName,
  applyIdentifiers,
  availabilityFor,
  isAbsoluteHttpsUrl,
  GoogleImageValidationError,
};
