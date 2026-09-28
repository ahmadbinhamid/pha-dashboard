// services/marketplace/ebayPayloadPreview.service.js
// Builds the eBay inventory item a sync would send, without calling eBay.

const Product = require("../../models/Product");
const MarketplaceListing = require("../../models/MarketplaceListing");
const ProductVariant = require("../../models/ProductVariant");
const { resolveListing, hydrateResolved } = require("./listing.resolver");
const { getAdapter } = require("./registry");
const {
  buildInventoryItemFromResolved,
  buildOfferFromResolved,
  normalizeCondition,
  getAccessToken,
  getInventoryItem,
  getOffersForSku,
  getInventoryLocations,
} = require("../ebay/ebay.api.service");
const { MARKETPLACE_PLATFORM } = require("../../constants/marketplace.constants");

const IMAGE_CHECK_TIMEOUT_MS = 10_000;

// The same populate chain syncListing uses, so the preview can't drift.
async function findEbayListingBySku(sku, tenantId = null) {
  const product = await Product.findOne({ sku, ...(tenantId ? { tenant_id: tenantId } : {}) }).select("_id").lean();
  if (!product) return null;
  return MarketplaceListing.findOne({ product: product._id, platform: MARKETPLACE_PLATFORM.EBAY })
    .populate({ path: "product", populate: { path: "attachments" } })
    .populate("photo_overrides");
}

// HEAD each photo: eBay must fetch every image, and a dead one can 500 it.
async function checkImage(url) {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(IMAGE_CHECK_TIMEOUT_MS) });
    return { url, status: res.status, type: res.headers.get("content-type"), bytes: Number(res.headers.get("content-length")) || null };
  } catch (err) {
    return { url, status: null, error: err.message };
  }
}

// GETs only: what eBay holds now for this SKU, to compare with what we send.
async function readLiveState(settings, sku, locationKey) {
  const token = await getAccessToken(settings);
  if (!token) return { error: "Could not get an eBay access token" };
  // Settled, not all: one failing eBay read shouldn't hide the others.
  const [item, offers, locations] = await Promise.allSettled([
    getInventoryItem(token, settings, sku),
    getOffersForSku(token, settings, sku),
    getInventoryLocations(token, settings),
  ]);
  const failed = (r) => (r.status === "rejected" ? r.reason.message : null);
  const locationList = locations.value ?? [];
  const location = locationList.find((l) => l.merchantLocationKey === locationKey) || null;
  return {
    inventoryItem: item.value?.body ?? null,
    offers: offers.value?.body?.offers ?? [],
    location: location ? { key: location.merchantLocationKey, status: location.merchantLocationStatus } : null,
    allLocationKeys: locationList.map((l) => `${l.merchantLocationKey} (${l.merchantLocationStatus})`),
    readErrors: { inventoryItem: failed(item), offers: failed(offers), locations: failed(locations) },
  };
}

/** What a sync would send eBay; with live, also what eBay holds (GETs only). */
async function previewEbayInventoryItem(sku, tenantId = null, { live = false } = {}) {
  const listing = await findEbayListingBySku(sku, tenantId);
  if (!listing) return null;

  const adapter = getAdapter(MARKETPLACE_PLATFORM.EBAY);
  const settings = await adapter.loadSettings(listing.product.tenant_id);
  const variant = listing.variant ? await ProductVariant.findById(listing.variant).populate("attachments") : null;
  const resolved = adapter.withRenderedDescription(resolveListing(listing, listing.product, variant));
  await hydrateResolved([resolved], adapter, listing.tenant_id);

  // Category-specific condition needs an eBay call; the plain mapping is used.
  const condition = normalizeCondition(resolved.condition, resolved.sku);
  const quantity = adapter.resolveQuantity(resolved);
  const item = buildInventoryItemFromResolved(resolved, quantity, condition, settings);
  const offer = buildOfferFromResolved(resolved, settings, quantity);
  const images = await Promise.all((item.product.imageUrls || []).map(checkImage));
  const liveState = live ? await readLiveState(settings, resolved.sku, offer.merchantLocationKey) : null;
  const stored = {
    syncStatus: listing.sync_status,
    ebayItemId: listing.external_listing_id,
    offerId: listing.external_offer_id,
    lastConfirmedQty: listing.ebay_synced_quantity ?? listing.synced_quantity ?? null,
    syncedAt: listing.synced_at ?? null,
  };
  return { listingId: String(listing._id), syncError: listing.sync_error, stored, item, offer, images, liveState };
}

module.exports = { previewEbayInventoryItem, findEbayListingBySku };
