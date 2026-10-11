// services/meta/meta.listing.service.js
// Meta listing write preparation; writes go through listing.write.service.

const { LISTING_STATE } = require("../../constants/marketplace.constants");

/** Meta discriminator fields; everything else comes from the product. */
function buildCreateFields(payload) {
  const { meta_product_category = null, gtin = null } = payload;
  // ACTIVE, not DRAFT: create is itself the push, so a failed first sync retries.
  return { state: LISTING_STATE.ACTIVE, meta_product_category, gtin };
}

const UPDATE_FIELDS = [
  "title_override", "description_override", "price_override", "photo_overrides",
  "meta_product_category", "gtin", "state",
];

// Product fields the update response populates.
const UPDATE_PRODUCT_FIELDS = "title slug sku price brand attachments";

/** $set for an update. */
async function buildUpdate(payload) {
  const update = {};
  for (const key of UPDATE_FIELDS) {
    if (payload[key] !== undefined) update[key] = payload[key];
  }
  if (update.price_override != null) update.price_override = Number(update.price_override);
  return update;
}

module.exports = { buildCreateFields, buildUpdate, UPDATE_PRODUCT_FIELDS, PUSH_ON_CREATE: true };
