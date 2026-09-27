// services/marketplace/adapters/ebay.adapter.js
// eBay adapter (pure translator); every quantity push goes via publish/update.

const { logger } = require("../../../loaders/logging");
const {
  EbayApiError,
  credentialsConfigured,
  getAccessToken,
  buildInventoryItemFromResolved,
  normalizeCondition,
  buildOfferFromResolved,
  upsertInventoryItem,
  createOffer,
  updateOffer,
  publishOffer,
  getOffer,
  withdrawOffer,
  deleteProduct,
  ensureLocation,
} = require("../../ebay/ebay.api.service");
const { getConditionPolicies } = require("../../ebay/ebay.catalog.service");
const { getSettings: getEbaySettings } = require("../../ebay/ebay.settings.service");
const { renderEbayDescription, descriptionInputFromResolved } = require("../../ebay/ebay.description.template");
const { assertFieldValues, assertProductConstraints } = require("../fieldSchema");
const {
  fieldSchema,
  productConstraints,
  fieldValues,
  UPFRONT_KEYS,
  POLICY_KEYS,
} = require("./ebay.fieldSchema");
const { EBAY_ERROR_CODE, EBAY_RELISTABLE_STATUSES } = require("../../../constants/ebay.constants");
const { httpError } = require("../../../utils/http/httpError");

const key = "ebay";

// Merged with ChannelConnection status in GET /channels; no eBay logo asset.
const manifest = {
  key,
  name: "eBay",
  logo: null,
  description: "Publish listings and sync inventory with eBay.",
  status: "active",
  authType: "oauth",
  setupSteps: [
    "Connect your eBay seller account via OAuth",
    "Set your eBay marketplace and warehouse address",
    "Choose default fulfillment/payment/return business policies",
  ],
  requiredTenantData: ["marketplace_id", "warehouse_address", "business_policies"],
  // Channel-only fields for the product form's eBay panel.
  fieldSchema,
  productConstraints,
};

// I/O the resolver hydrates onto `resolved` before calling us.
const needs = { branding: true, stock: true };

// Listing field for the channel category (falls back to the tenant mapping).
const categoryField = "ebay_category_id";

const capabilities = {
  publish: true,
  inventory: true,
  batch: false,
  orders: true,
  webhooks: true,
  inboundInventory: true,
  variants: true,
};

// NOTE: never null, so an unconnected eBay tenant throws instead of skipping.
async function loadSettings(tenantId) {
  return getEbaySettings(tenantId);
}

// Poller baseline (ours vs eBay edits). TODO(dual-write): drop after backfill.
function syncBaselineFields(quantity) {
  return { ebay_synced_quantity: quantity, ebay_synced_at: new Date(), ebay_pending_reconcile_qty: null };
}

// Same-family fallbacks (25021); used leads with 3000, 4000-6000 are media.
const CONDITION_FALLBACK_ORDER = {
  new: ["NEW", "NEW_OTHER", "LIKE_NEW", "CERTIFIED_REFURBISHED", "EXCELLENT_REFURBISHED", "VERY_GOOD_REFURBISHED", "GOOD_REFURBISHED", "SELLER_REFURBISHED"],
  used: ["USED_EXCELLENT", "USED_VERY_GOOD", "USED_GOOD", "USED_ACCEPTABLE", "FOR_PARTS_OR_NOT_WORKING"],
};

// status 400 = per-item data error, so the circuit breaker won't trip.
class ConditionUnverifiedError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConditionUnverifiedError";
    this.status = 400;
    this.code = "CONDITION_UNVERIFIED";
  }
}

// Condition the category accepts; unverifiable fails hard (not a late 25021).
async function resolveCategoryCondition(rawCondition, categoryId, settings, sku = null) {
  const fallback = normalizeCondition(rawCondition, sku);
  if (!categoryId) {
    // No category: publish() throws right after; update() skips the offer.
    logger.debug(`[EbayAdapter] resolveCategoryCondition: no ebay_category_id yet — using "${fallback}" unverified`);
    return fallback;
  }

  const marketplaceId = settings?.marketplace_id || "unknown";
  const sandbox = !!settings?.sandbox;

  let conditions;
  try {
    ({ conditions } = await getConditionPolicies(categoryId, settings));
  } catch (err) {
    logger.warn(
      `[EbayAdapter] condition policy lookup failed for category ${categoryId} (marketplace ${marketplaceId}, sandbox=${sandbox}): ${err.message}`,
    );
    throw new ConditionUnverifiedError(
      `Could not verify item condition for eBay category ${categoryId}: condition policy lookup failed (${err.message})`,
    );
  }

  const validIds = conditions.map((c) => c.conditionId);

  if (validIds.length === 0) {
    logger.warn(
      `[EbayAdapter] condition policy lookup for category ${categoryId} (marketplace ${marketplaceId}, sandbox=${sandbox}) returned no accepted conditions`,
    );
    throw new ConditionUnverifiedError(
      `Could not verify item condition for eBay category ${categoryId}: eBay returned no accepted conditions for this category`,
    );
  }

  // Verified — happy path, stays silent so logs don't get noisy.
  if (validIds.includes(fallback)) return fallback;

  const family = fallback === "NEW" ? "new" : "used";
  const preferred = CONDITION_FALLBACK_ORDER[family].find((c) => validIds.includes(c));
  if (preferred) {
    logger.warn(`[EbayAdapter] condition "${fallback}" invalid for category ${categoryId} — using "${preferred}" instead`);
    return preferred;
  }

  logger.warn(`[EbayAdapter] condition "${fallback}" invalid for category ${categoryId} and no same-family match — using "${validIds[0]}" instead`);
  return validIds[0];
}

function isPriceLockedBySaleError(err) {
  return err instanceof EbayApiError && err.hasErrorId(EBAY_ERROR_CODE.PRICE_LOCKED_BY_ACTIVE_SALE);
}

// Stale/deleted offer id; see EBAY_ERROR_CODE for why two codes mean this.
function isOfferMissingError(err) {
  return (
    err instanceof EbayApiError &&
    (err.hasErrorId(EBAY_ERROR_CODE.OFFER_NOT_FOUND_INPUT) || err.hasErrorId(EBAY_ERROR_CODE.OFFER_NOT_FOUND_RESOURCE))
  );
}

// Soft-skips 25019 (offer in an active sale); resolves once the sale ends.
async function updateOfferTolerant(token, settings, offerId, offerBody, sku) {
  try {
    await updateOffer(token, settings, offerId, offerBody);
    return { priceLocked: false };
  } catch (err) {
    if (!isPriceLockedBySaleError(err)) throw err;
    logger.warn(`[EbayAdapter] ${sku}: price update skipped — offer ${offerId} is part of an active eBay sale`);
    return { priceLocked: true };
  }
}

// Creates an offer, or on 25002 updates the existing one eBay reports.
async function createOrRecoverOffer(token, settings, offerBody, sku) {
  try {
    const offerId = await createOffer(token, settings, offerBody);
    return { offerId, priceLocked: false };
  } catch (createErr) {
    const existingMatch = createErr.message.match(/"name":"offerId","value":"(\d+)"/);
    if (!existingMatch) throw createErr;
    const offerId = existingMatch[1];
    logger.warn(`[EbayAdapter] offer already exists (${offerId}), switching to updateOffer`);
    const { priceLocked } = await updateOfferTolerant(token, settings, offerId, offerBody, sku);
    return { offerId, priceLocked };
  }
}

// 25004: eBay refuses qty 0 on a live listing without out-of-stock control.
function isInvalidListingQuantityError(err) {
  return err instanceof EbayApiError && err.hasErrorId(EBAY_ERROR_CODE.INVALID_LISTING_QUANTITY);
}

// Upserts the item; on a refused 0, ends the listing instead (restock relists).
async function pushInventoryItem(token, settings, inventoryItem, quantity, offerId, hooks) {
  const { sku } = inventoryItem;
  try {
    await upsertInventoryItem(token, settings, inventoryItem);
  } catch (err) {
    if (quantity !== 0 || !offerId || !isInvalidListingQuantityError(err)) throw err;
    logger.warn(`[EbayAdapter] ${sku}: eBay refused qty 0 (no out-of-stock control) — withdrawing offer ${offerId}`);
    await withdrawOfferTolerant(token, settings, offerId, sku);
    try {
      await upsertInventoryItem(token, settings, inventoryItem);
    } catch (retryErr) {
      if (!isInvalidListingQuantityError(retryErr)) throw retryErr;
      // NOTE: no baseline stamp: eBay still holds the old qty, poller must agree.
      logger.warn(`[EbayAdapter] ${sku}: listing ended; eBay kept its last qty`);
      return;
    }
  }
  logger.info(`[EbayAdapter] inventory_item upserted: ${sku} (qty: ${quantity ?? "untracked"})`);
  // Untracked stock (null) has no baseline to stamp.
  if (quantity != null) await hooks.onQuantityPushed?.(quantity);
}

// A sold-out listing eBay already ended can't be withdrawn again; that's fine.
async function withdrawOfferTolerant(token, settings, offerId, sku) {
  try {
    await withdrawOffer(token, settings, offerId);
    logger.info(`[EbayAdapter] ${sku}: offer ${offerId} withdrawn (listing ended)`);
  } catch (err) {
    logger.warn(`[EbayAdapter] ${sku}: withdraw offer ${offerId} failed, continuing: ${err.message}`);
  }
}

// Relists an offer whose listing ended (e.g. sold out); returns the new id.
async function relistIfEnded(token, settings, offerId, sku) {
  const offer = await getOffer(token, settings, offerId);
  const listingStatus = offer.listing?.listingStatus;
  if (offer.status === "PUBLISHED" && !EBAY_RELISTABLE_STATUSES.includes(listingStatus)) return null;
  if (listingStatus === "EBAY_ENDED") {
    logger.warn(`[EbayAdapter] ${sku}: listing was ended by eBay (policy) — not relisting`);
    return null;
  }
  const listingId = await publishOffer(token, settings, offerId);
  logger.info(`[EbayAdapter] ${sku}: ended listing relisted on restock, listingId: ${listingId}`);
  return listingId;
}

// null = untracked stock: skip qty and baseline rather than invent a number.
function resolveQuantity(resolved) {
  if (!resolved.product.stock_control) return null;
  if (!resolved.stock) throw new Error(`[EbayAdapter] ${resolved.sku}: resolved.stock missing — hydrate via listing.resolver#hydrateResolved`);
  return resolved.stock.quantity;
}

// NOTE: no override => template rendered from live data (legacy ones too).
function withRenderedDescription(resolved) {
  if (resolved.listing?.description_override) return resolved;
  const branding = resolved.branding || {};
  const html = renderEbayDescription(descriptionInputFromResolved(resolved), {
    businessName: branding.company_name,
    logoUrl: branding.logo_url,
  });
  return { ...resolved, description: html };
}

// Listing category, else the tenant's mapping.
function effectiveCategoryId(resolved) {
  return resolved.category?.id || resolved.listing?.ebay_category_id || null;
}

// Enforces fieldSchema rules; `keys` picks which apply at this step.
function assertEbayFields(resolved, settings, keys) {
  const values = fieldValues(resolved.listing, { categoryId: effectiveCategoryId(resolved), settings, product: resolved.product });
  assertFieldValues(key, fieldSchema, values, { keys, sku: resolved.sku });
}

// Checked before any eBay write.
function assertUpfrontFields(resolved, settings) {
  assertProductConstraints(key, productConstraints, resolved);
  assertEbayFields(resolved, settings, UPFRONT_KEYS);
}

async function publish(resolved, settings, hooks = {}, _seq = null) {
  resolved = withRenderedDescription(resolved);
  if (!credentialsConfigured(settings)) {
    throw httpError("[EbayAdapter] eBay credentials not configured for this tenant", 422);
  }

  const token = await getAccessToken(settings);
  if (!token) throw httpError("[EbayAdapter] Could not obtain eBay access token", 401);

  const { listing } = resolved;
  assertUpfrontFields(resolved, settings);
  const quantity = resolveQuantity(resolved);

  // Push 0 too so eBay stops selling; sync.service flags OUT_OF_STOCK after.

  // Step 1 — inventory item
  const categoryId = effectiveCategoryId(resolved);
  const condition = await resolveCategoryCondition(resolved.condition, categoryId, settings, resolved.sku);
  const inventoryItem = buildInventoryItemFromResolved(resolved, quantity, condition, settings);
  await pushInventoryItem(token, settings, inventoryItem, quantity, listing.external_offer_id, hooks);

  // Same point as the old category check (after the item write).
  assertEbayFields(resolved, settings, ["ebay_category_id"]);
  // publishOffer needs all three policies (listing or tenant default).
  assertEbayFields(resolved, settings, POLICY_KEYS);

  // Step 2 - ensure merchant location exists (built from warehouse address)
  await ensureLocation(token, settings);

  // Step 4 - create/update offer (recovers from 25002 or a dead offerId)
  logger.info(`[EbayAdapter] using categoryId: "${categoryId}" (${resolved.category?.source || "listing"})`);
  const offerBody = buildOfferFromResolved(resolved, settings, quantity);
  let offerId = listing.external_offer_id || null;
  let priceLocked = false;

  if (offerId) {
    try {
      ({ priceLocked } = await updateOfferTolerant(token, settings, offerId, offerBody, resolved.sku));
      if (!priceLocked) logger.info(`[EbayAdapter] offer updated: ${offerId}`);
    } catch (err) {
      if (!isOfferMissingError(err)) throw err;
      logger.warn(`[EbayAdapter] ${resolved.sku}: stored offer ${offerId} no longer exists on eBay — recreating`);
      ({ offerId, priceLocked } = await createOrRecoverOffer(token, settings, offerBody, resolved.sku));
      logger.info(`[EbayAdapter] offer recreated: ${offerId}`);
    }
  } else {
    ({ offerId, priceLocked } = await createOrRecoverOffer(token, settings, offerBody, resolved.sku));
    logger.info(`[EbayAdapter] offer created: ${offerId}`);
  }

  // Persist before publish so a retry after failure can't duplicate the offer.
  await hooks.onOfferCreated?.(offerId);

  // Step 5 — publish
  const listingId = await publishOffer(token, settings, offerId);
  logger.info(`[EbayAdapter] offer published, listingId: ${listingId}`);

  return {
    external_listing_id: listingId,
    external_offer_id: offerId,
    quantity,
    ...(priceLocked ? { priceLocked: true } : {}),
  };
}

async function update(resolved, settings, hooks = {}, _seq = null) {
  resolved = withRenderedDescription(resolved);
  if (!credentialsConfigured(settings)) {
    throw httpError("[EbayAdapter] eBay credentials not configured for this tenant", 422);
  }

  const token = await getAccessToken(settings);
  if (!token) throw httpError("[EbayAdapter] Could not obtain eBay access token", 401);

  const { listing } = resolved;
  // NOTE: policies not enforced on update; a live offer may use eBay state.
  assertUpfrontFields(resolved, settings);
  const quantity = resolveQuantity(resolved);

  // Step 1 — sync inventory item
  const categoryId = effectiveCategoryId(resolved);
  const condition = await resolveCategoryCondition(resolved.condition, categoryId, settings, resolved.sku);
  const inventoryItem = buildInventoryItemFromResolved(resolved, quantity, condition, settings);
  await pushInventoryItem(token, settings, inventoryItem, quantity, listing.external_offer_id, hooks);

  if (!categoryId) {
    logger.warn(`[EbayAdapter] ${resolved.sku}: ebay_category_id missing — skipping offer update`);
    return {
      external_listing_id: listing.external_listing_id || null,
      external_offer_id: listing.external_offer_id || null,
      quantity,
    };
  }

  // Step 2 - update offer (recreated below if the stored offerId is dead)
  const offerBody = buildOfferFromResolved(resolved, settings, quantity);
  let offerId = listing.external_offer_id || null;

  if (offerId) {
    try {
      const { priceLocked } = await updateOfferTolerant(token, settings, offerId, offerBody, resolved.sku);
      if (!priceLocked) logger.info(`[EbayAdapter] offer updated: ${offerId}`);
      // Back in stock: a listing eBay ended at 0 needs republishing to sell.
      const relistedId = quantity > 0 ? await relistIfEnded(token, settings, offerId, resolved.sku) : null;
      return {
        external_listing_id: relistedId || listing.external_listing_id || null,
        external_offer_id: offerId,
        quantity,
        ...(priceLocked ? { priceLocked: true } : {}),
      };
    } catch (err) {
      if (!isOfferMissingError(err)) throw err;
      logger.warn(`[EbayAdapter] ${resolved.sku}: stored offer ${offerId} no longer exists on eBay — recreating`);
      offerId = null;
    }
  }

  // Active but offerId lost or dead - re-create and re-publish
  const { offerId: newOfferId, priceLocked } = await createOrRecoverOffer(token, settings, offerBody, resolved.sku);
  offerId = newOfferId;
  // Persist immediately; see publish() for why.
  await hooks.onOfferCreated?.(offerId);
  const listingId = await publishOffer(token, settings, offerId);
  return {
    external_listing_id: listingId,
    external_offer_id: offerId,
    quantity,
    ...(priceLocked ? { priceLocked: true } : {}),
  };
}

// Context from sync.service#endListing (product is null when deleted).
async function end(listing, { product, settings, sku } = {}) {
  const offerId = listing.external_offer_id || null;

  if (!sku) {
    logger.warn("[EbayAdapter] end called with no resolvable SKU — nothing to withdraw");
    return;
  }
  if (!product) {
    logger.warn(`[EbayAdapter] end: product not found for listing ${listing._id} — cannot resolve tenant, nothing to withdraw`);
    return;
  }

  const result = await deleteProduct(settings, sku, offerId);
  // Keep status/cause so the breaker classifies HTTP and network failures.
  if (result.error) throw httpError(result.error, result.status, { cause: result.cause });
  logger.info(`[EbayAdapter] listing ended: ${sku}`);
}

module.exports = {
  key,
  manifest,
  capabilities,
  needs,
  categoryField,
  loadSettings,
  publish,
  update,
  end,
  syncBaselineFields,
  // Exported for tests only, not the adapter contract.
  resolveCategoryCondition,
  ConditionUnverifiedError,
};
