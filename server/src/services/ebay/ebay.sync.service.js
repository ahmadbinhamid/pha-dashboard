// services/ebay/ebay.sync.service.js
// eBay sync orchestration — coordinates product/inventory services with the eBay API layer

const { logger } = require("../../loaders/logging");
const {
  credentialsConfigured,
  getAccessToken,
  loadSettings,
  buildInventoryItem,
  upsertInventoryItem,
  buildOffer,
  createOffer,
  updateOffer,
  publishOffer,
} = require("./ebay.api.service");
const {
  findProductWithAttachments,
  updateProductEbayStatus,
  updateVariantEbayStatus,
} = require("../product.service");
const { getTotalStockForProductVariant } = require("../inventory.service");

async function syncProduct(productPlain, variants = []) {
  if (!credentialsConfigured()) {
    logger.warn("[eBay] syncProduct skipped — credentials not configured");
    return { skipped: true };
  }

  const token = await getAccessToken();
  if (!token) return { error: "Could not obtain access token" };

  const product = await findProductWithAttachments(productPlain._id);
  if (!product) return { error: "Product not found in DB" };

  const settings = await loadSettings();

  await updateProductEbayStatus(product._id, { ebay_sync_status: "pending" });

  const results = [];

  try {
    const itemsToSync =
      variants.length > 0
        ? variants.map((v) => ({
            sku: v.sku || `ph-${product._id}-${v._id}`,
            variantId: v._id,
            existingOfferId: v.ebay_offer_id || null,
          }))
        : [
            {
              sku: product.sku || `ph-${product._id}`,
              variantId: null,
              existingOfferId: product.ebay_offer_id || null,
            },
          ];

    for (const item of itemsToSync) {
      const { sku, variantId, existingOfferId } = item;

      try {
        const totalQty = await getTotalStockForProductVariant(product._id, variantId);
        // stock_control=false means merchant doesn't track inventory → always available
        const quantity = product.stock_control ? totalQty : Math.max(totalQty, 1);

        // Bail early for zero stock — eBay rejects qty=0 on both upsert and publish
        if (quantity === 0) {
          logger.warn(`[eBay] ${sku}: stock is 0 — skipping eBay sync, marked out_of_stock`);
          if (variantId) {
            await updateVariantEbayStatus(variantId, { ebay_sync_status: "out_of_stock" });
          } else {
            await updateProductEbayStatus(product._id, { ebay_sync_status: "out_of_stock" });
          }
          results.push({ sku, ok: true, published: false, reason: "out_of_stock" });
          continue;
        }

        // Step 1 — inventory item
        const inventoryItem = buildInventoryItem(product, sku, quantity);
        await upsertInventoryItem(token, inventoryItem);
        logger.info(`[eBay] inventory_item upserted: ${sku} (qty: ${quantity})`);

        if (!product.ebay_category_id) {
          logger.warn(`[eBay] ${sku}: ebay_category_id missing — skipping offer/publish`);
          results.push({ sku, ok: true, published: false, reason: "no_category" });
          continue;
        }

        const offerBody = buildOffer(product, sku, settings, quantity);
        let offerId = existingOfferId;

        if (offerId) {
          // Step 2a — update existing offer
          await updateOffer(token, offerId, offerBody);
          logger.info(`[eBay] offer updated: ${offerId}`);
        } else {
          // Step 2b — create new offer; recover if it already exists (error 25002)
          try {
            offerId = await createOffer(token, offerBody);
            logger.info(`[eBay] offer created: ${offerId}`);
          } catch (createErr) {
            const existingMatch = createErr.message.match(/"name":"offerId","value":"(\d+)"/);
            if (existingMatch) {
              offerId = existingMatch[1];
              logger.warn(`[eBay] offer already exists (${offerId}), switching to updateOffer`);
              await updateOffer(token, offerId, offerBody);
              logger.info(`[eBay] offer updated (recovered from 25002): ${offerId}`);
            } else {
              throw createErr;
            }
          }
        }

        // Step 3 — publish
        // Skip if qty=0 — eBay rejects publish with zero stock.
        // Skip if already published (ebay_listing_id set) — updateOffer already synced the change.
        const alreadyLive = variantId ? false : !!product.ebay_listing_id;

        if (quantity === 0) {
          logger.warn(`[eBay] ${sku}: stock is 0 — skipping publish, marked out_of_stock`);
          if (variantId) {
            await updateVariantEbayStatus(variantId, {
              ebay_offer_id: offerId,
              ebay_sync_status: "out_of_stock",
            });
          } else {
            await updateProductEbayStatus(product._id, {
              ebay_offer_id: offerId,
              ebay_sync_status: "out_of_stock",
            });
          }
          results.push({ sku, ok: true, offerId, published: false, reason: "out_of_stock" });
          continue;
        }

        if (alreadyLive) {
          logger.info(`[eBay] ${sku}: listing already live (${product.ebay_listing_id}), updateOffer applied`);
          results.push({ sku, ok: true, offerId, listingId: product.ebay_listing_id });
          continue;
        }

        const listingId = await publishOffer(token, offerId);
        logger.info(`[eBay] offer published, listingId: ${listingId}`);

        if (variantId) {
          await updateVariantEbayStatus(variantId, {
            ebay_offer_id: offerId,
            ebay_listing_id: listingId,
            ebay_sync_status: "synced",
          });
        } else {
          await updateProductEbayStatus(product._id, {
            ebay_offer_id: offerId,
            ebay_listing_id: listingId,
            ebay_sync_status: "synced",
            ebay_synced_at: new Date(),
          });
        }

        results.push({ sku, ok: true, offerId, listingId });
      } catch (itemErr) {
        logger.error(`[eBay] sync failed for SKU ${sku}: ${itemErr.message}`);
        results.push({ sku, error: itemErr.message });

        if (!variantId) {
          await updateProductEbayStatus(product._id, { ebay_sync_status: "error" });
        }
      }
    }

    const allOk = results.every((r) => r.ok);
    if (variants.length > 0) {
      await updateProductEbayStatus(product._id, {
        ebay_sync_status: allOk ? "synced" : "error",
        ebay_synced_at: allOk ? new Date() : undefined,
      });
    }

    return { results };
  } catch (err) {
    logger.error(`[eBay] syncProduct error: ${err.message}`);
    await updateProductEbayStatus(product._id, { ebay_sync_status: "error" });
    return { error: err.message };
  }
}

module.exports = { syncProduct };
