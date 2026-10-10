// services/marketplace/adapters/meta.adapter.js
// Meta Commerce Catalog adapter; async: pushes return a batch handle.

const { logger } = require("../../../loaders/logging");
const config = require("../../../config");
const { findConnection } = require("../channel-connection.service");
const metaOauthService = require("../../meta/meta.oauth.service");
const metaCatalogApi = require("../../meta/meta.catalog-api.service");
const { MARKETPLACE_PLATFORM } = require("../../../constants/marketplace.constants");
const {
  META_AVAILABILITY,
  META_BATCH_METHOD,
  META_BATCH_DONE_STATUS,
  META_BATCH_MAX_ITEMS,
  META_MIN_IMAGE_PX,
  META_MAX_ADDITIONAL_IMAGES,
  META_EXTERNAL_ID_PREFIX,
} = require("../../../constants/meta.constants");
const { assertFieldValues, assertProductConstraints } = require("../fieldSchema");
const { httpError } = require("../../../utils/http/httpError");
const { isAbsoluteHttpsUrl } = require("../../../utils/url");
const { richTextToLines } = require("../../../utils/richText");
const { fieldSchema, fieldValues, toMetaCondition } = require("./meta.fieldSchema");

const key = MARKETPLACE_PLATFORM.META;

// Per-item data problem: 400 keeps it off the breaker.
class MetaItemValidationError extends Error {
  constructor(message, code = "META_ITEM_INVALID") {
    super(message);
    this.name = "MetaItemValidationError";
    this.status = 400;
    this.code = code;
  }
}

const manifest = {
  key,
  name: "Meta",
  logo: null,
  description: "Publish your catalogue to Facebook and Instagram Shops via a Meta Commerce catalog.",
  status: "active",
  authType: "oauth",
  setupSteps: [
    "Sign in with Facebook Login for Business",
    "Pick the business and catalog this store publishes to",
    "Shoppers check out on your own storefront",
  ],
  requiredTenantData: ["business_id", "catalog_id"],
  // Website checkout: every item links to the tenant's verified storefront.
  requiresStorefront: true,
  // Meta caps titles at 200 characters.
  productConstraints: { title: { maxLength: 200 } },
  fieldSchema,
};

const capabilities = {
  publish: true,
  inventory: true,
  batch: true,
  asyncPublish: true,
  orders: false,
  webhooks: false,
  inboundInventory: false,
  variants: true,
};

const categoryField = "meta_product_category";
// Meta accepts google_product_category, so the Google mapping is the default.
const categoryFallbackPlatform = MARKETPLACE_PLATFORM.GOOGLE;

const needs = { stock: true, productUrl: true, imageSizes: true };

// Generic contract: no row returns null, which sync treats as not connected.
async function loadSettings(tenantId) {
  return findConnection(tenantId, key, { withTokens: true });
}

function assertConfigured(settings) {
  if (!settings?.access_token_ct || !settings?.catalog_id) {
    throw httpError("[MetaAdapter] Meta is not fully configured for this tenant (missing token or catalog) — reconnect via Settings.", 422);
  }
}

// NOTE: a null token means the stored ciphertext won't decrypt: auth, so 401.
function tokenFor(settings, context) {
  const token = metaOauthService.getAccessToken(settings);
  if (!token) throw httpError(`[MetaAdapter] ${context}: could not obtain a Meta access token`, 401);
  return token;
}

/** Stable listing id; prefixed as external_listing_id is globally unique. */
function buildExternalListingId(settings, retailerId) {
  return `${META_EXTERNAL_ID_PREFIX}:${settings.catalog_id}:${retailerId}`;
}

function availabilityFor(quantity) {
  return quantity > 0 ? META_AVAILABILITY.IN_STOCK : META_AVAILABILITY.OUT_OF_STOCK;
}

// Meta's format: amount, a space, ISO 4217 code, e.g. "12.34 AUD".
function formatPrice(amount) {
  return `${Number(amount || 0).toFixed(2)} ${config.stripe.currency.toUpperCase()}`;
}

// Meta wants plain text with no HTML.
function toPlainText(value) {
  return richTextToLines(value || "").join("\n").trim();
}

// Variants share the product's group id; product _id never changes.
function itemGroupIdFor(resolved) {
  return resolved.variant ? `ph-${resolved.product._id}` : null;
}

// Reason an image fails Meta's rules, or null when it passes.
function imageProblem(url, size) {
  if (!isAbsoluteHttpsUrl(url)) return `is not a public HTTPS URL (got "${url}")`;
  if (!size) return "size could not be verified (Meta needs a JPEG or PNG)";
  if (size.width < META_MIN_IMAGE_PX || size.height < META_MIN_IMAGE_PX) {
    return `is ${size.width}x${size.height}; Meta needs at least ${META_MIN_IMAGE_PX}x${META_MIN_IMAGE_PX}`;
  }
  return null;
}

// Throws on a bad primary image; bad extra images are dropped with a warning.
function resolveImages(resolved) {
  const urls = (resolved.photos || []).map((p) => (typeof p === "string" ? p : p?.url));
  const sizes = resolved.photoSizes || [];
  if (!urls[0]) throw new MetaItemValidationError(`[MetaAdapter] ${resolved.sku}: product has no images`, "INVALID_IMAGE");
  const primaryProblem = imageProblem(urls[0], sizes[0]);
  if (primaryProblem) {
    throw new MetaItemValidationError(`[MetaAdapter] ${resolved.sku}: primary image ${primaryProblem}`, "INVALID_IMAGE");
  }
  const additional = [];
  for (let i = 1; i < urls.length && additional.length < META_MAX_ADDITIONAL_IMAGES; i++) {
    const problem = urls[i] ? imageProblem(urls[i], sizes[i]) : "is missing";
    if (problem) logger.warn(`[MetaAdapter] ${resolved.sku}: dropping additional image ${i}: ${problem}`);
    else additional.push(urls[i]);
  }
  return { imageLink: urls[0], additional };
}

function effectiveCategoryId(resolved) {
  return resolved.category?.id || resolved.listing.meta_product_category || null;
}

// fieldSchema rules plus Meta's own required fields, before any API call.
function assertMetaFields(resolved) {
  assertFieldValues(key, fieldSchema, fieldValues(resolved.listing, { categoryId: effectiveCategoryId(resolved) }), {
    sku: resolved.sku,
  });
  assertProductConstraints(key, manifest.productConstraints, resolved);
  if (!resolved.brand) throw new MetaItemValidationError(`[MetaAdapter] ${resolved.sku}: brand is required by Meta`);
  if (!toMetaCondition(resolved.condition)) {
    throw new MetaItemValidationError(`[MetaAdapter] ${resolved.sku}: condition must be new, refurbished or used`);
  }
}

// Same rule as Google: stock_control off is excluded, never shown in stock.
function isUntrackedStock(resolved) {
  return resolved.product?.stock_control === false;
}

function resolveQuantity(resolved) {
  if (resolved.hydrationError) throw resolved.hydrationError;
  if (!resolved.stock) throw new Error(`[MetaAdapter] ${resolved.sku}: resolved.stock missing — hydrate via listing.resolver#hydrateResolved`);
  return resolved.stock.quantity;
}

function resolveProductUrl(resolved) {
  if (resolved.productUrlError) throw resolved.productUrlError;
  return resolved.productUrl;
}

// NOTE: docs renamed inventory to quantity_to_sell_on_facebook; sent as that.
function buildItemData(resolved, quantity, productUrl) {
  const { imageLink, additional } = resolveImages(resolved);
  const { gtin, mpn } = resolved.identifiers || {};
  const groupId = itemGroupIdFor(resolved);
  return {
    id: resolved.sku,
    title: resolved.title,
    description: toPlainText(resolved.description) || resolved.title,
    availability: availabilityFor(quantity),
    condition: toMetaCondition(resolved.condition),
    price: formatPrice(resolved.price),
    link: productUrl,
    image_link: imageLink,
    ...(additional.length ? { additional_image_link: additional } : {}),
    brand: resolved.brand,
    quantity_to_sell_on_facebook: quantity,
    google_product_category: effectiveCategoryId(resolved),
    ...(gtin ? { gtin } : {}),
    ...(mpn ? { mpn } : {}),
    ...(groupId ? { item_group_id: groupId } : {}),
  };
}

/** Upsert request for one item; skip, or throws a per-item error. */
function prepareItem(resolved) {
  if (isUntrackedStock(resolved)) {
    logger.info(`[MetaAdapter] ${resolved.sku}: stock_control is off — excluded from Meta, not published as in stock`);
    return { skipped: true, reason: "untracked_stock" };
  }
  assertMetaFields(resolved);
  const quantity = resolveQuantity(resolved);
  const data = buildItemData(resolved, quantity, resolveProductUrl(resolved));
  return { request: { method: META_BATCH_METHOD.UPSERT, data }, quantity };
}

// Immediate per-row validation errors, keyed by retailer id.
function validationErrorsById(validationStatus) {
  const byId = new Map();
  for (const row of validationStatus || []) {
    const messages = (row.errors || []).map((e) => e.message).filter(Boolean);
    if (messages.length) byId.set(String(row.retailer_id), messages.join("; "));
    for (const w of row.warnings || []) logger.warn(`[MetaAdapter] ${row.retailer_id}: Meta warning: ${w.message}`);
  }
  return byId;
}

// One items_batch call; a whole-call throw is the caller's (breaker counts it).
async function sendBatch(token, settings, requests) {
  const { handles, validationStatus } = await metaCatalogApi.itemsBatch(token, settings.catalog_id, requests);
  return { handle: handles[0] ?? null, rejected: validationErrorsById(validationStatus) };
}

function pendingResult(settings, sent, retailerId, quantity) {
  if (sent.rejected.has(retailerId)) {
    return { ok: false, error: `Meta rejected ${retailerId}: ${sent.rejected.get(retailerId)}`, status: 400 };
  }
  // NOTE: no handle and no reason means nothing was ingested; fail loudly.
  if (!sent.handle) return { ok: false, error: `Meta ingested nothing for ${retailerId} (no batch handle returned)`, status: 400 };
  return { pending: true, handle: sent.handle, retailer_id: retailerId, external_listing_id: buildExternalListingId(settings, retailerId), quantity };
}

async function publishOne(resolved, settings) {
  assertConfigured(settings);
  const prepared = prepareItem(resolved);
  if (prepared.skipped) return prepared;
  const sent = await sendBatch(tokenFor(settings, resolved.sku), settings, [prepared.request]);
  const result = pendingResult(settings, sent, resolved.sku, prepared.quantity);
  if (!result.pending) throw new MetaItemValidationError(`[MetaAdapter] ${result.error}`);
  logger.info(`[MetaAdapter] ${resolved.sku}: queued in Meta batch ${result.handle} (qty: ${prepared.quantity})`);
  return result;
}

async function publish(resolved, settings) {
  return publishOne(resolved, settings);
}

async function update(resolved, settings) {
  return publishOne(resolved, settings);
}

// Results keep input order; prep failures stay per item and never reach Meta.
async function publishBatch(resolvedList, settings) {
  assertConfigured(settings);
  const token = tokenFor(settings, "publishBatch");
  const results = new Array(resolvedList.length);
  const queued = [];
  resolvedList.forEach((resolved, index) => {
    try {
      const prepared = prepareItem(resolved);
      if (prepared.skipped) results[index] = prepared;
      else queued.push({ index, sku: resolved.sku, ...prepared });
    } catch (err) {
      logger.warn(`[MetaAdapter] batch item failed before send: ${resolved?.sku}: ${err.message}`);
      results[index] = { ok: false, error: err.message, status: err.status ?? null };
    }
  });
  for (let start = 0; start < queued.length; start += META_BATCH_MAX_ITEMS) {
    const slice = queued.slice(start, start + META_BATCH_MAX_ITEMS);
    const sent = await sendBatch(token, settings, slice.map((q) => q.request));
    for (const item of slice) results[item.index] = pendingResult(settings, sent, item.sku, item.quantity);
  }
  return results;
}

// Context from sync.service#loadEndContext; deletes by the same retailer id.
async function end(listing, { product, settings, sku } = {}) {
  if (!product || !sku) {
    logger.warn(`[MetaAdapter] end: listing ${listing._id} has no resolvable product/SKU — nothing to withdraw`);
    return undefined;
  }
  if (!settings) {
    logger.warn(`[MetaAdapter] end: tenant ${product.tenant_id} has no Meta connection — nothing to withdraw`);
    return undefined;
  }
  assertConfigured(settings);
  const request = { method: META_BATCH_METHOD.DELETE, data: { id: sku } };
  const sent = await sendBatch(tokenFor(settings, `end ${sku}`), settings, [request]);
  const result = pendingResult(settings, sent, sku, null);
  if (!result.pending) throw new MetaItemValidationError(`[MetaAdapter] end: ${result.error}`);
  logger.info(`[MetaAdapter] ${sku}: delete queued in Meta batch ${result.handle}`);
  return result;
}

// Failed ids from errors[] and ids_of_invalid_requests; unnamed ones counted.
function collectFailures(node) {
  const failures = new Map();
  for (const e of node.errors || []) {
    const id = e.retailer_id ?? e.id;
    if (id != null) failures.set(String(id), e.message || "Rejected by Meta");
  }
  for (const id of node.ids_of_invalid_requests || []) {
    if (!failures.has(String(id))) failures.set(String(id), "Rejected by Meta (see Commerce Manager for details)");
  }
  const total = Number(node.errors_total_count) || 0;
  return { failures, unattributedErrors: Math.max(0, total - failures.size) };
}

/** Batch status as { done, failures: Map(id -> msg), unattributedErrors }. */
async function checkBatchStatus(handle, settings) {
  assertConfigured(settings);
  const node = await metaCatalogApi.checkBatchRequestStatus(tokenFor(settings, "checkBatchStatus"), settings.catalog_id, handle);
  // NOTE: only "finished" is documented; any other status keeps polling.
  if (!node || node.status !== META_BATCH_DONE_STATUS) return { done: false, status: node?.status ?? null };
  return { done: true, status: node.status, ...collectFailures(node) };
}

module.exports = {
  key,
  manifest,
  capabilities,
  categoryField,
  categoryFallbackPlatform,
  needs,
  loadSettings,
  publish,
  update,
  end,
  publishBatch,
  checkBatchStatus,
  // Exported for tests.
  buildItemData,
  buildExternalListingId,
  availabilityFor,
  formatPrice,
  itemGroupIdFor,
  MetaItemValidationError,
};
