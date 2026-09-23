const Joi = require("joi");
const { LISTING_STATE, LISTING_SYNC_STATUS } = require("../constants/marketplace.constants");
const { EBAY_TITLE_MAX_LENGTH } = require("../constants/ebay.constants");
const { validateFieldValues } = require("../services/marketplace/fieldSchema");
const { fieldSchema, fieldValues, POLICY_KEYS } = require("../services/marketplace/adapters/ebay.fieldSchema");

const listListings = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    product: Joi.string(),
    // Comma-separated product ids for the Products page's batch Channel-column lookup; bypasses pagination.
    product_in: Joi.string(),
    state: Joi.string().valid(...Object.values(LISTING_STATE)),
    sync_status: Joi.string().valid(...Object.values(LISTING_SYNC_STATUS)),
    search: Joi.string().allow(""),
  }),
};

// Validates a fully-populated listing document before enqueuing for eBay sync.
// `categoryId` is the effective category (listing value, else the tenant's mapping);
// `settings` supplies the tenant's default business policies.
function validateListingForPush(listing, product, { categoryId = listing.ebay_category_id, settings = null } = {}) {
  const errors = [];

  // Validates the EFFECTIVE title (override, else product), so an over-long product title
  // is caught here rather than rejected by eBay.
  const usingOverride = !!listing.title_override;
  const title = usingOverride ? listing.title_override : product?.title;
  if (!title?.trim()) {
    errors.push({ field: "title_override", message: "Listing title is required." });
  } else if (title.length > EBAY_TITLE_MAX_LENGTH) {
    errors.push({
      field: "title_override",
      message: usingOverride
        ? `eBay title override is ${title.length} characters — eBay allows ${EBAY_TITLE_MAX_LENGTH}.`
        : `Product title is ${title.length} characters — eBay allows ${EBAY_TITLE_MAX_LENGTH}. Shorten it or set an eBay title override.`,
    });
  }

  // Category + business policies come from the shared fieldSchema (same rules the adapter enforces).
  // NOTE: a tenant default policy now satisfies this, matching what the adapter actually sends.
  errors.push(
    ...validateFieldValues(fieldSchema, fieldValues(listing, { categoryId, settings }), {
      keys: ["ebay_category_id", ...POLICY_KEYS],
    }),
  );

  const overrideImages = (listing.photo_overrides || []).filter((a) => a?.type === "image");
  const productImages = (product?.attachments || []).filter((a) => a?.type === "image");
  const effectiveImages = overrideImages.length > 0 ? overrideImages : productImages;
  if (effectiveImages.length === 0) {
    errors.push({ field: "photo_overrides", message: "At least 1 image is required by eBay." });
  } else if (effectiveImages.length > 24) {
    errors.push({ field: "photo_overrides", message: "Maximum 24 images allowed by eBay." });
  }

  const price = listing.price_override ?? product?.price;
  if (price == null || isNaN(Number(price)) || Number(price) <= 0) {
    errors.push({ field: "price_override", message: "A valid price greater than A$0 is required." });
  }

  if (listing.quantity_available != null) {
    const qty = Number(listing.quantity_available);
    if (!Number.isInteger(qty) || qty < 1) {
      errors.push({ field: "quantity_available", message: "Quantity must be a whole number of 1 or more." });
    }
  }

  if (listing.format === "AUCTION") {
    const auctionDurations = ["DAYS_1", "DAYS_3", "DAYS_5", "DAYS_7", "DAYS_10"];
    if (!listing.listing_duration || !auctionDurations.includes(listing.listing_duration)) {
      errors.push({ field: "listing_duration", message: "Auctions must have a fixed duration (1, 3, 5, 7 or 10 days) — not GTC." });
    }
    if (listing.accept_best_offer) {
      errors.push({ field: "accept_best_offer", message: "Best Offer is not available for auction format." });
    }
  }

  if (listing.accept_best_offer && listing.min_best_offer != null) {
    const min = Number(listing.min_best_offer);
    if (isNaN(min) || min <= 0) {
      errors.push({ field: "min_best_offer", message: "Minimum best offer must be greater than A$0." });
    } else {
      const p = Number(price);
      if (!isNaN(p) && p > 0 && min >= p) {
        errors.push({ field: "min_best_offer", message: "Minimum best offer must be less than the listing price." });
      }
    }
  }

  const brand = listing.item_specifics?.brand;
  const mpn = listing.item_specifics?.mpn;
  if (brand && !mpn) {
    errors.push({ field: "item_specifics", message: "MPN is required when Brand is set (use \"Does Not Apply\" if unknown)." });
  }
  if (mpn && mpn !== "Does Not Apply" && !brand) {
    errors.push({ field: "item_specifics", message: "Brand is required when MPN is set." });
  }

  return errors;
}

module.exports = { validateListingForPush, listListings };
