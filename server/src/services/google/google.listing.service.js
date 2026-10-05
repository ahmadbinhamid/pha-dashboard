// services/google/google.listing.service.js
// Google listing write preparation; writes go through listing.write.service.

const { LISTING_STATE } = require("../../constants/marketplace.constants");

/** Google discriminator fields; most data comes from the product itself. */
function buildCreateFields(payload) {
  const { google_product_category = null, gtin = null, mpn = null, condition = null, shipping_label = null } = payload;
  // ACTIVE, not DRAFT: create is itself the push, so a failed first sync retries.
  return { state: LISTING_STATE.ACTIVE, google_product_category, gtin, mpn, condition, shipping_label };
}

const UPDATE_FIELDS = [
  "title_override", "description_override", "price_override", "photo_overrides",
  "google_product_category", "gtin", "mpn", "condition", "shipping_label",
  "custom_label_0", "custom_label_1", "custom_label_2", "custom_label_3", "custom_label_4",
  "state",
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

// Google's create is a "lightweight toggle": it queues the first sync itself.
module.exports = { buildCreateFields, buildUpdate, UPDATE_PRODUCT_FIELDS, PUSH_ON_CREATE: true };
