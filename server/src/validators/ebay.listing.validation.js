// Validates a fully-populated listing document before enqueuing for eBay sync
function validateListingForPush(listing, product) {
  const errors = [];

  const title = listing.title_override || product?.title;
  if (!title?.trim()) {
    errors.push({ field: "title_override", message: "Listing title is required." });
  } else if (title.length > 80) {
    errors.push({ field: "title_override", message: "Title must be 80 characters or fewer (eBay limit)." });
  }

  if (!listing.ebay_category_id) {
    errors.push({ field: "ebay_category_id", message: "eBay category is required." });
  }

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

  if (!listing.fulfillment_policy_id) {
    errors.push({ field: "fulfillment_policy_id", message: "A shipping policy is required." });
  }
  if (!listing.payment_policy_id) {
    errors.push({ field: "payment_policy_id", message: "A payment policy is required." });
  }
  if (!listing.return_policy_id) {
    errors.push({ field: "return_policy_id", message: "A return policy is required." });
  }

  return errors;
}

module.exports = { validateListingForPush };
