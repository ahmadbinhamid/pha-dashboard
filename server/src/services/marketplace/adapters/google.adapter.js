// services/marketplace/adapters/google.adapter.js
// Google Shopping (Merchant API v1) adapter; feed-shaped, publish == update.

const { logger } = require("../../../loaders/logging");
const config = require("../../../config");
const { findConnection } = require("../channelConnection.service");
const googleOauthService = require("../../google/google.oauth.service");
const googleMerchantApi = require("../../google/google.merchant.api.service");
const { MARKETPLACE_PLATFORM } = require("../../../constants/marketplace.constants");
const { assertFieldValues } = require("../fieldSchema");
const { httpError } = require("../../../utils/http/httpError");
const { fieldSchema, fieldValues, toGoogleCondition } = require("./google.fieldSchema");

// Google disapproves a bad imageLink later, async; 400 keeps the breaker shut.
class GoogleImageValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "GoogleImageValidationError";
    this.status = 400;
    this.code = "INVALID_IMAGE_URL";
  }
}

// URL parse, not startsWith, so a value merely containing https:// fails.
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
  // Merchant Center disapproves products without a verified storefront domain.
  requiresStorefront: true,
  // Channel-only fields for the product form's Google panel.
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

// Listing field for the channel category (falls back to the tenant mapping).
const categoryField = "google_product_category";

// I/O the resolver hydrates onto `resolved` before calling us.
const needs = { stock: true, productUrl: true };

// Google expires products not refreshed in 30 days; default stays under that.
const refreshIntervalDays = config.channels.refreshIntervalDays;

// Generic contract: no row returns null, which sync treats as not connected.
async function loadSettings(tenantId) {
  return findConnection(tenantId, key, { withTokens: true });
}

function assertConfigured(settings) {
  if (!settings?.refresh_token_ct || !settings?.merchant_id || !settings?.data_source_id) {
    throw httpError(
      `[GoogleAdapter] Google Shopping is not fully configured for this tenant (missing refresh token, ` +
        `merchant_id, or data_source_id) — reconnect via Settings.`,
      422,
    );
  }
}

// v1 drops the channel~ prefix; a wrong name 404s on delete, which end() eats.
function buildProductResourceName(settings, sku) {
  return `${settings.content_language}~${settings.feed_label}~${sku}`;
}

// delete needs the full path; insert takes the short name as offerId.
function buildFullProductResourceName(settings, sku) {
  return `accounts/${settings.merchant_id}/products/${buildProductResourceName(settings, sku)}`;
}

// v1 wants ALL_CAPS enums; lowercase "in stock" is rejected with a 400.
function availabilityFor(quantity) {
  return quantity > 0 ? "IN_STOCK" : "OUT_OF_STOCK";
}

// gtin, else mpn+brand, else identifierExists: false; never invents an id.
function applyIdentifiers(attributes, identifiers, sku) {
  if (identifiers.gtin) {
    // v1 renamed gtin to gtins (an array); a listing only ever has one GTIN.
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

// Throws on a bad primary image; bad extra images are dropped with a warning.
function buildProductInputFromResolved(resolved, settings, quantity, identifiers, productUrl) {
  const { sku, title, description, price, photos, listing, product } = resolved;
  // Listing category, else the tenant's mapping.
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

  // NOTE: some v1 names (price, condition, shippingLabel) are unverified live.
  const attributes = {
    title,
    description,
    link: productUrl,
    imageLink: primaryImageUrl,
    ...(additionalImageUrls.length > 0 ? { additionalImageLinks: additionalImageUrls } : {}),
    availability: availabilityFor(quantity),
    condition: toGoogleCondition(resolved.condition),
    price: {
      amountMicros: String(Math.round((price || 0) * 1_000_000)),
      currencyCode: settings.target_country ? currencyForCountry(settings.target_country) : "USD",
    },
    // Omitted when unset so account shipping rules apply, not free shipping.
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

  // v1 removed `channel` from ProductInput; the other keys are unchanged.
  return {
    contentLanguage: settings.content_language,
    feedLabel: settings.feed_label,
    offerId: sku,
    productAttributes: attributes,
  };
}

// No shared currency map exists; minimal fallback for likely tenant countries.
const COUNTRY_CURRENCY = { AU: "AUD", US: "USD", GB: "GBP", NZ: "NZD", CA: "CAD" };
function currencyForCountry(countryCode) {
  return COUNTRY_CURRENCY[countryCode] || "USD";
}

// Enforces fieldSchema rules on effective values.
function assertGoogleFields(resolved) {
  const categoryId = resolved.category?.id || resolved.listing.google_product_category;
  assertFieldValues(key, fieldSchema, fieldValues(resolved.listing, { categoryId }), { sku: resolved.sku });
}

// stock_control off: keep it off Google rather than publish it as in stock.
function isUntrackedStock(resolved) {
  return resolved.product?.stock_control === false;
}

// Hydrated quantity; a batch hydration failure surfaces here, per item.
function resolveQuantity(resolved) {
  if (resolved.hydrationError) throw resolved.hydrationError;
  if (!resolved.stock) throw new Error(`[GoogleAdapter] ${resolved.sku}: resolved.stock missing — hydrate via listing.resolver#hydrateResolved`);
  return resolved.stock.quantity;
}

// Rethrows a product URL error captured during hydration.
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
  // NOTE: null only when the stored refresh token won't decrypt: auth, so 401.
  if (!token) throw httpError(`[GoogleAdapter] ${resolved.sku}: could not obtain a valid Google access token`, 401);

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

// Context from sync.service#endListing (product is null when deleted).
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

  // NOTE: ignores the variant SKU, unlike publish.
  const sku = listing.store_sku || product.sku || `ph-${product._id}`;
  const token = await googleOauthService.getValidAccessToken(settings);
  if (!token) throw httpError(`[GoogleAdapter] end: could not obtain a valid Google access token for tenant ${product.tenant_id}`, 401);

  await googleMerchantApi.deleteProductInput(token, settings, buildFullProductResourceName(settings, sku));
  logger.info(`[GoogleAdapter] listing ended: ${sku}`);
}

// No Merchant API batch endpoint; results keep input order for syncBatch.
const BATCH_CONCURRENCY = 10;

async function publishBatch(resolvedList, settings) {
  assertConfigured(settings);

  const token = await googleOauthService.getValidAccessToken(settings);
  if (!token) throw httpError("[GoogleAdapter] publishBatch: could not obtain a valid Google access token", 401);

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

  // Small worker pool over an index cursor; chunks are small, so no p-limit.
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
