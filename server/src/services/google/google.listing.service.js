// services/google/google.listing.service.js
// CREATE/UPDATE only; browse/read/delete/push go through listing.query.service.js instead.
// Much smaller than ebay.listing.service.js since Google's adapter derives most fields from the
// product/ChannelConnection directly — only GTIN/MPN/condition/category are asked per listing.

const MarketplaceListing = require("../../models/MarketplaceListing");
const Product = require("../../models/Product");
const { MARKETPLACE_PLATFORM, LISTING_STATE } = require("../../constants/marketplace.constants");

async function createListing(payload, tenantId) {
  const {
    product,
    variant = null,
    google_product_category = null,
    gtin = null,
    mpn = null,
    condition = null,
    shipping_label = null,
  } = payload;

  const productDoc = await Product.findOne({ _id: product, tenant_id: tenantId }).select("_id");
  if (!productDoc) throw Object.assign(new Error("Product not found"), { status: 404 });

  // Idempotency, mirroring ebay.listing.service.js#createListing's check-then-create.
  const existing = await MarketplaceListing.findOne({
    tenant_id: tenantId,
    product,
    variant,
    platform: MARKETPLACE_PLATFORM.GOOGLE,
  });
  if (existing) return existing;

  try {
    // state: ACTIVE, not DRAFT — this create call is itself the push action, unlike eBay's
    // multi-step flow, so a transient first-sync failure still leaves it eligible for retry.
    return await MarketplaceListing.create({
      tenant_id: tenantId,
      platform: MARKETPLACE_PLATFORM.GOOGLE,
      product,
      variant,
      state: LISTING_STATE.ACTIVE,
      google_product_category,
      gtin,
      mpn,
      condition,
      shipping_label,
    });
  } catch (err) {
    // Same non-atomic race as eBay's — recover by returning whichever request actually won.
    if (err.code === 11000 && err.keyPattern?.product) {
      const winner = await MarketplaceListing.findOne({
        tenant_id: tenantId,
        product,
        variant,
        platform: MARKETPLACE_PLATFORM.GOOGLE,
      });
      if (winner) return winner;
    }
    throw err;
  }
}

async function updateListing(id, payload, tenantId) {
  const allowed = [
    "title_override", "description_override", "price_override", "photo_overrides",
    "google_product_category", "gtin", "mpn", "condition", "shipping_label",
    "custom_label_0", "custom_label_1", "custom_label_2", "custom_label_3", "custom_label_4",
    "state",
  ];

  const update = {};
  for (const key of allowed) {
    if (payload[key] !== undefined) update[key] = payload[key];
  }
  if (update.price_override != null) update.price_override = Number(update.price_override);

  return MarketplaceListing.findOneAndUpdate({ _id: id, tenant_id: tenantId }, { $set: update }, { new: true, strict: false })
    .populate("product", "title slug sku price brand attachments")
    .populate("variant", "display_name sku price attachments")
    .populate("photo_overrides");
}

module.exports = { createListing, updateListing };
