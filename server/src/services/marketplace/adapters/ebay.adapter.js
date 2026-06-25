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
  buildOfferFromResolved,
  upsertInventoryItem,
  createOffer,
  updateOffer,
  publishOffer,
  updateInventoryQuantity,
  deleteProduct,
} = require("../../ebay/ebay.api.service");
const { getTotalStockForProductVariant } = require("../../inventory.service");

const key = "ebay";

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
  const inventoryItem = buildInventoryItemFromResolved(resolved, quantity);
  await upsertInventoryItem(token, inventoryItem);
  logger.info(`[EbayAdapter] inventory_item upserted: ${resolved.sku} (qty: ${quantity})`);

  if (!listing.ebay_category_id) {
    throw new Error(`[EbayAdapter] ${resolved.sku}: ebay_category_id is required to publish`);
  }

  // Step 2 — create offer (recover from 25002 if it already exists)
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

  // Step 3 — publish
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
  const inventoryItem = buildInventoryItemFromResolved(resolved, quantity);
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
  const sku = listing.store_sku || null;
  if (!sku) {
    logger.warn("[EbayAdapter] end called with no SKU — nothing to withdraw");
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
