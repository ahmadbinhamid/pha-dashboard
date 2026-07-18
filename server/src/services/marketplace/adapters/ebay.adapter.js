// services/marketplace/adapters/ebay.adapter.js
//
// Implements the marketplace adapter interface for eBay.
// Wraps the existing eBay API service so the underlying HTTP sequence
// (upsert inventory item → create/recover offer → publish) is unchanged.
//
// Interface:
//   key                                   -> "ebay"
//   publish(resolved, settings)           -> { external_listing_id, external_offer_id }
//   update(resolved, settings)            -> { external_listing_id, external_offer_id }
//   end(listing)                          -> void
//   pushInventory(sku, quantity)          -> void

const { logger } = require("../../../loaders/logging");
const {
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
const { getTotalStockForProductVariant } = require("../../inventory.service");
const { resolveSku } = require("../listing.resolver");
const Product = require("../../../models/Product");
const ProductVariant = require("../../../models/ProductVariant");

const key = "ebay";

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
async function resolveCategoryCondition(rawCondition, categoryId) {
  const fallback = normalizeCondition(rawCondition);
  if (!categoryId) return fallback;

  try {
    const { conditions } = await getConditionPolicies(categoryId);
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

async function resolveQuantity(resolved) {
  const { product, variant } = resolved;
  const total = await getTotalStockForProductVariant(
    product._id,
    variant ? variant._id : null,
  );
  // stock_control=false → merchant doesn't track inventory → always available
  return product.stock_control ? total : Math.max(total, 1);
}

async function publish(resolved, settings) {
  if (!credentialsConfigured()) {
    throw new Error("[EbayAdapter] eBay credentials not configured");
  }

  const token = await getAccessToken();
  if (!token) throw new Error("[EbayAdapter] Could not obtain eBay access token");

  const { listing } = resolved;
  const quantity = await resolveQuantity(resolved);

  if (quantity === 0) {
    logger.warn(`[EbayAdapter] ${resolved.sku}: stock is 0 — skipping publish`);
    return { skipped: true, reason: "out_of_stock" };
  }

  // Step 1 — inventory item
  const condition = await resolveCategoryCondition(listing.condition, listing.ebay_category_id);
  const inventoryItem = buildInventoryItemFromResolved(resolved, quantity, condition);
  await upsertInventoryItem(token, inventoryItem);
  logger.info(`[EbayAdapter] inventory_item upserted: ${resolved.sku} (qty: ${quantity})`);

  if (!listing.ebay_category_id) {
    throw new Error(`[EbayAdapter] ${resolved.sku}: ebay_category_id is required to publish`);
  }

  // Step 2 — ensure merchant location exists (creates it from env vars if missing)
  await ensureLocation(token);

  // Step 4 — create offer (recover from 25002 if it already exists)
  logger.info(`[EbayAdapter] using categoryId: "${listing.ebay_category_id}"`);
  const offerBody = buildOfferFromResolved(resolved, settings, quantity);
  let offerId = listing.external_offer_id || null;

  if (offerId) {
    await updateOffer(token, offerId, offerBody);
    logger.info(`[EbayAdapter] offer updated: ${offerId}`);
  } else {
    try {
      offerId = await createOffer(token, offerBody);
      logger.info(`[EbayAdapter] offer created: ${offerId}`);
    } catch (createErr) {
      const existingMatch = createErr.message.match(/"name":"offerId","value":"(\d+)"/);
      if (existingMatch) {
        offerId = existingMatch[1];
        logger.warn(`[EbayAdapter] offer already exists (${offerId}), switching to updateOffer`);
        await updateOffer(token, offerId, offerBody);
        logger.info(`[EbayAdapter] offer updated (recovered from 25002): ${offerId}`);
      } else {
        throw createErr;
      }
    }
  }

  // Step 5 — publish
  const listingId = await publishOffer(token, offerId);
  logger.info(`[EbayAdapter] offer published, listingId: ${listingId}`);

  return {
    external_listing_id: listingId,
    external_offer_id: offerId,
  };
}

async function update(resolved, settings) {
  if (!credentialsConfigured()) {
    throw new Error("[EbayAdapter] eBay credentials not configured");
  }

  const token = await getAccessToken();
  if (!token) throw new Error("[EbayAdapter] Could not obtain eBay access token");

  const { listing } = resolved;
  const quantity = await resolveQuantity(resolved);

  if (quantity === 0) {
    logger.warn(`[EbayAdapter] ${resolved.sku}: stock is 0 — syncing zero quantity`);
  }

  // Step 1 — sync inventory item
  const condition = await resolveCategoryCondition(listing.condition, listing.ebay_category_id);
  const inventoryItem = buildInventoryItemFromResolved(resolved, quantity, condition);
  await upsertInventoryItem(token, inventoryItem);
  logger.info(`[EbayAdapter] inventory_item upserted (update): ${resolved.sku}`);

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
    await updateOffer(token, offerId, offerBody);
    logger.info(`[EbayAdapter] offer updated: ${offerId}`);
  } else {
    // Listing is "active" but we lost the offerId — re-create and re-publish
    try {
      offerId = await createOffer(token, offerBody);
    } catch (createErr) {
      const existingMatch = createErr.message.match(/"name":"offerId","value":"(\d+)"/);
      if (existingMatch) {
        offerId = existingMatch[1];
        await updateOffer(token, offerId, offerBody);
      } else {
        throw createErr;
      }
    }
    const listingId = await publishOffer(token, offerId);
    return { external_listing_id: listingId, external_offer_id: offerId };
  }

  return {
    external_listing_id: listing.external_listing_id || null,
    external_offer_id: offerId,
  };
}

async function end(listing) {
  const offerId = listing.external_offer_id || null;

  let sku = listing.store_sku || null;
  if (!sku) {
    // Derive SKU the same way publish() does — store_sku → variant.sku → product.sku → ph-<id>
    const productId = listing.product?._id || listing.product;
    const variantId = listing.variant?._id || listing.variant || null;
    const [product, variant] = await Promise.all([
      Product.findById(productId).select("_id sku").lean(),
      variantId ? ProductVariant.findById(variantId).select("_id sku").lean() : Promise.resolve(null),
    ]);
    if (product) sku = resolveSku(listing, product, variant);
  }

  if (!sku) {
    logger.warn("[EbayAdapter] end called with no resolvable SKU — nothing to withdraw");
    return;
  }

  const result = await deleteProduct(sku, offerId);
  if (result.error) throw new Error(result.error);
  logger.info(`[EbayAdapter] listing ended: ${sku}`);
}

async function pushInventory(sku, quantity) {
  const result = await updateInventoryQuantity(sku, quantity);
  if (result.error) throw new Error(result.error);
}

module.exports = { key, publish, update, end, pushInventory };
