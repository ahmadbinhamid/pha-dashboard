// services/marketplace/adapters/ebay.adapter.js
//
// Implements the marketplace adapter interface for eBay.
// Wraps the existing eBay API service so the underlying HTTP sequence
// (upsert inventory item → create/recover offer → publish) is unchanged.
//
// Multi-tenant: `settings` (an EbaySettings doc, see ebay.settings.service.js)
// carries this tenant's refresh_token/marketplace/policies and is threaded
// into every eBay API call instead of a single global credential.
//
// Interface:
//   key                                            -> "ebay"
//   publish(resolved, settings, hooks?)            -> { external_listing_id, external_offer_id }
//   update(resolved, settings, hooks?)             -> { external_listing_id, external_offer_id }
//   end(listing)                                   -> void
//   pushInventory(sku, quantity)                   -> void
//
// hooks.onOfferCreated(offerId) is invoked as soon as an offer ID is known,
// before the (separate, failure-prone) publish call — lets the caller persist
// it immediately so a later failure doesn't cause a retry to recreate the offer.

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
  updateInventoryQuantity,
  deleteProduct,
  ensureLocation,
} = require("../../ebay/ebay.api.service");
const { getConditionPolicies } = require("../../ebay/ebay.catalog.service");
const { getSettings: getEbaySettings } = require("../../ebay/ebay.settings.service");
const { EBAY_ERROR_CODE } = require("../../../constants/ebay.constants");
const { getTotalStockForProductVariant, resolveSkuToIds } = require("../../inventory.service");
const { resolveSku } = require("../listing.resolver");
const Product = require("../../../models/Product");
const ProductVariant = require("../../../models/ProductVariant");
const MarketplaceListing = require("../../../models/MarketplaceListing");

const key = "ebay";

// Keeps MarketplaceListing.ebay_synced_quantity current whenever WE push a
// quantity to eBay, so the inventory-sync poller (ebay.inventory-sync.service.js)
// can tell "eBay changed since we last touched it" apart from "we're the ones
// who just changed it" — without this, our own push would look identical to
// a manual edit on eBay's side and get redundantly (and confusingly) diffed.
async function updateSyncBaseline(productId, variantId, quantity) {
  await MarketplaceListing.updateOne(
    { product: productId, variant: variantId || null, platform: key },
    { $set: { ebay_synced_quantity: quantity } },
  );
}

// Preferred fallback order when the stored condition isn't accepted for the
// listing's category — e.g. "USED_GOOD" is invalid for a primary category
// that only allows "USED_ACCEPTABLE" (eBay error 25021). We stay within the
// same condition family (new-like vs. used-like) rather than jumping across.
const CONDITION_FALLBACK_ORDER = {
  new: ["NEW", "NEW_OTHER", "LIKE_NEW", "CERTIFIED_REFURBISHED", "EXCELLENT_REFURBISHED", "VERY_GOOD_REFURBISHED", "GOOD_REFURBISHED", "SELLER_REFURBISHED"],
  used: ["USED_GOOD", "USED_VERY_GOOD", "USED_EXCELLENT", "USED_ACCEPTABLE", "FOR_PARTS_OR_NOT_WORKING"],
};

// Resolves the stored listing condition to one eBay actually accepts for the
// listing's primary category, cross-checking against the Sell Metadata API's
// per-category condition policy instead of assuming a static mapping is
// always valid (it isn't — accepted conditions vary by category).
async function resolveCategoryCondition(rawCondition, categoryId, settings) {
  const fallback = normalizeCondition(rawCondition);
  if (!categoryId) return fallback;

  try {
    const { conditions } = await getConditionPolicies(categoryId, settings);
    const validIds = conditions.map((c) => c.conditionId);
    if (validIds.length === 0 || validIds.includes(fallback)) return fallback;

    const family = fallback === "NEW" ? "new" : "used";
    const preferred = CONDITION_FALLBACK_ORDER[family].find((c) => validIds.includes(c));
    if (preferred) {
      logger.warn(`[EbayAdapter] condition "${fallback}" invalid for category ${categoryId} — using "${preferred}" instead`);
      return preferred;
    }

    logger.warn(`[EbayAdapter] condition "${fallback}" invalid for category ${categoryId} and no same-family match — using "${validIds[0]}" instead`);
    return validIds[0];
  } catch (err) {
    logger.warn(`[EbayAdapter] could not verify condition policies for category ${categoryId}: ${err.message}`);
    return fallback;
  }
}

function isPriceLockedBySaleError(err) {
  return err instanceof EbayApiError && err.hasErrorId(EBAY_ERROR_CODE.PRICE_LOCKED_BY_ACTIVE_SALE);
}

// updateOffer, tolerant of eBay rejecting the price/quantity revision because
// the offer is part of an active sale (error 25019) — that's not something
// retrying or erroring out helps with, it resolves itself once the sale ends
// or is reconfigured on eBay, so this is treated as a soft skip (logged, not
// thrown) rather than the same hard failure as every other updateOffer error.
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

async function resolveQuantity(resolved) {
  const { product, variant } = resolved;
  const total = await getTotalStockForProductVariant(
    product._id,
    variant ? variant._id : null,
  );
  // stock_control=false → merchant doesn't track inventory → always available
  return product.stock_control ? total : Math.max(total, 1);
}

async function publish(resolved, settings, hooks = {}) {
  if (!credentialsConfigured(settings)) {
    throw new Error("[EbayAdapter] eBay credentials not configured for this tenant");
  }

  const token = await getAccessToken(settings);
  if (!token) throw new Error("[EbayAdapter] Could not obtain eBay access token");

  const { listing } = resolved;
  const quantity = await resolveQuantity(resolved);

  if (quantity === 0) {
    logger.warn(`[EbayAdapter] ${resolved.sku}: stock is 0 — skipping publish`);
    return { skipped: true, reason: "out_of_stock" };
  }

  // Step 1 — inventory item
  const condition = await resolveCategoryCondition(listing.condition, listing.ebay_category_id, settings);
  const inventoryItem = buildInventoryItemFromResolved(resolved, quantity, condition, settings);
  await upsertInventoryItem(token, settings, inventoryItem);
  logger.info(`[EbayAdapter] inventory_item upserted: ${resolved.sku} (qty: ${quantity})`);
  await updateSyncBaseline(resolved.product._id, resolved.variant?._id, quantity);

  if (!listing.ebay_category_id) {
    throw new Error(`[EbayAdapter] ${resolved.sku}: ebay_category_id is required to publish`);
  }

  // Step 2 — ensure merchant location exists (creates it from this tenant's
  // warehouse address if missing)
  await ensureLocation(token, settings);

  // Step 4 — create offer (recover from 25002 if it already exists)
  logger.info(`[EbayAdapter] using categoryId: "${listing.ebay_category_id}"`);
  const offerBody = buildOfferFromResolved(resolved, settings, quantity);
  let offerId = listing.external_offer_id || null;
  let priceLocked = false;

  if (offerId) {
    ({ priceLocked } = await updateOfferTolerant(token, settings, offerId, offerBody, resolved.sku));
    if (!priceLocked) logger.info(`[EbayAdapter] offer updated: ${offerId}`);
  } else {
    try {
      offerId = await createOffer(token, settings, offerBody);
      logger.info(`[EbayAdapter] offer created: ${offerId}`);
    } catch (createErr) {
      const existingMatch = createErr.message.match(/"name":"offerId","value":"(\d+)"/);
      if (existingMatch) {
        offerId = existingMatch[1];
        logger.warn(`[EbayAdapter] offer already exists (${offerId}), switching to updateOffer`);
        ({ priceLocked } = await updateOfferTolerant(token, settings, offerId, offerBody, resolved.sku));
        if (!priceLocked) logger.info(`[EbayAdapter] offer updated (recovered from 25002): ${offerId}`);
      } else {
        throw createErr;
      }
    }
  }

  // Persist the offer ID immediately, before the publish call — otherwise a
  // publishOffer() failure/timeout leaves the local doc unaware the offer
  // already exists, and a retry would call createOffer() again for the same
  // SKU, producing a second offer on eBay.
  await hooks.onOfferCreated?.(offerId);

  // Step 5 — publish
  const listingId = await publishOffer(token, settings, offerId);
  logger.info(`[EbayAdapter] offer published, listingId: ${listingId}`);

  return {
    external_listing_id: listingId,
    external_offer_id: offerId,
    ...(priceLocked ? { priceLocked: true } : {}),
  };
}

async function update(resolved, settings, hooks = {}) {
  if (!credentialsConfigured(settings)) {
    throw new Error("[EbayAdapter] eBay credentials not configured for this tenant");
  }

  const token = await getAccessToken(settings);
  if (!token) throw new Error("[EbayAdapter] Could not obtain eBay access token");

  const { listing } = resolved;
  const quantity = await resolveQuantity(resolved);

  if (quantity === 0) {
    logger.warn(`[EbayAdapter] ${resolved.sku}: stock is 0 — skipping update`);
    return { skipped: true, reason: "out_of_stock" };
  }

  // Step 1 — sync inventory item
  const condition = await resolveCategoryCondition(listing.condition, listing.ebay_category_id, settings);
  const inventoryItem = buildInventoryItemFromResolved(resolved, quantity, condition, settings);
  await upsertInventoryItem(token, settings, inventoryItem);
  logger.info(`[EbayAdapter] inventory_item upserted (update): ${resolved.sku}`);
  await updateSyncBaseline(resolved.product._id, resolved.variant?._id, quantity);

  if (!listing.ebay_category_id) {
    logger.warn(`[EbayAdapter] ${resolved.sku}: ebay_category_id missing — skipping offer update`);
    return {
      external_listing_id: listing.external_listing_id || null,
      external_offer_id: listing.external_offer_id || null,
    };
  }

  // Step 2 — update offer
  const offerBody = buildOfferFromResolved(resolved, settings, quantity);
  let offerId = listing.external_offer_id || null;

  if (offerId) {
    const { priceLocked } = await updateOfferTolerant(token, settings, offerId, offerBody, resolved.sku);
    if (!priceLocked) logger.info(`[EbayAdapter] offer updated: ${offerId}`);
    return {
      external_listing_id: listing.external_listing_id || null,
      external_offer_id: offerId,
      ...(priceLocked ? { priceLocked: true } : {}),
    };
  }

  // Listing is "active" but we lost the offerId — re-create and re-publish
  let priceLocked = false;
  try {
    offerId = await createOffer(token, settings, offerBody);
  } catch (createErr) {
    const existingMatch = createErr.message.match(/"name":"offerId","value":"(\d+)"/);
    if (existingMatch) {
      offerId = existingMatch[1];
      ({ priceLocked } = await updateOfferTolerant(token, settings, offerId, offerBody, resolved.sku));
    } else {
      throw createErr;
    }
  }
  // Persist immediately — see the comment in publish() for why this can't
  // wait until after publishOffer() succeeds.
  await hooks.onOfferCreated?.(offerId);
  const listingId = await publishOffer(token, settings, offerId);
  return {
    external_listing_id: listingId,
    external_offer_id: offerId,
    ...(priceLocked ? { priceLocked: true } : {}),
  };
}

async function end(listing) {
  const offerId = listing.external_offer_id || null;

  let sku = listing.store_sku || null;
  const productId = listing.product?._id || listing.product;
  const variantId = listing.variant?._id || listing.variant || null;
  const [product, variant] = await Promise.all([
    Product.findById(productId).select("_id sku tenant_id").lean(),
    variantId ? ProductVariant.findById(variantId).select("_id sku").lean() : Promise.resolve(null),
  ]);
  if (!sku && product) sku = resolveSku(listing, product, variant);

  if (!sku) {
    logger.warn("[EbayAdapter] end called with no resolvable SKU — nothing to withdraw");
    return;
  }
  if (!product) {
    logger.warn(`[EbayAdapter] end: product not found for listing ${listing._id} — cannot resolve tenant, nothing to withdraw`);
    return;
  }

  const settings = await getEbaySettings(product.tenant_id);
  const result = await deleteProduct(settings, sku, offerId);
  if (result.error) throw new Error(result.error);
  logger.info(`[EbayAdapter] listing ended: ${sku}`);
}

async function pushInventory(sku, quantity, tenantId) {
  // tenantId used to be discovered FROM the SKU lookup (find whatever
  // product resolveSkuToIds returned, then trust its tenant) — but SKUs
  // are only unique per-tenant, so an unscoped lookup could resolve a
  // different tenant's product entirely and push a quantity to the wrong
  // seller's eBay account. Now required, and used to scope the lookup
  // itself instead of being derived from its (possibly wrong) result.
  if (!tenantId) {
    throw new Error(`[EbayAdapter] pushInventory: tenantId is required (SKU ${sku})`);
  }

  const ids = await resolveSkuToIds(sku, tenantId);
  if (!ids) {
    throw new Error(`[EbayAdapter] pushInventory: could not resolve SKU ${sku} to a product for tenant ${tenantId}`);
  }

  const product = await Product.findOne({ _id: ids.productId, tenant_id: tenantId }).select("_id tenant_id").lean();
  if (!product) {
    throw new Error(`[EbayAdapter] pushInventory: product ${ids.productId} not found for SKU ${sku} under tenant ${tenantId}`);
  }

  const settings = await getEbaySettings(product.tenant_id);
  const result = await updateInventoryQuantity(settings, sku, quantity);
  if (result.error) throw new Error(result.error);

  await updateSyncBaseline(ids.productId, ids.variantId, quantity);
}

module.exports = { key, publish, update, end, pushInventory };
