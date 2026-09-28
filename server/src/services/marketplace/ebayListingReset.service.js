// services/marketplace/ebayListingReset.service.js
// Clears a sold-out SKU's stuck eBay record so the next sync publishes fresh.

const { getAdapter } = require("./registry");
const { resolveSku } = require("./listing.resolver");
const { findEbayListingBySku } = require("./ebayPayloadPreview.service");
const { getAccessToken, deleteProduct } = require("../ebay/ebay.api.service");
const { MARKETPLACE_PLATFORM } = require("../../constants/marketplace.constants");

/** Dry run unless confirm; never touches a listing eBay reports as live. */
async function resetEbayListing(productSku, tenantId = null, { confirm = false } = {}) {
  const listing = await findEbayListingBySku(productSku, tenantId);
  if (!listing) return { outcome: "not_found" };

  const adapter = getAdapter(MARKETPLACE_PLATFORM.EBAY);
  const settings = await adapter.loadSettings(listing.product.tenant_id);
  const token = settings && (await getAccessToken(settings));
  if (!token) return { outcome: "not_connected" };

  const ebaySku = resolveSku(listing, listing.product, null);
  const offerId = listing.external_offer_id || null;
  if (!(await adapter.listingIsGone(token, settings, offerId))) return { outcome: "live", ebaySku, offerId };
  if (!confirm) return { outcome: "would_reset", ebaySku, offerId };

  const removed = await deleteProduct(settings, ebaySku, offerId);
  if (removed.error) return { outcome: "ebay_refused", ebaySku, offerId, error: removed.error };
  await listing.updateOne({ $set: { external_listing_id: null, external_offer_id: null } });
  return { outcome: "reset", ebaySku, offerId };
}

module.exports = { resetEbayListing };
