import type { EbayListingFormState } from "@/types/marketplace";

export type EbayListingErrors = Partial<Record<keyof EbayListingFormState | "min_best_offer_amount", string>>;

// Auction durations allowed by eBay (GTC is Fixed Price only)
const AUCTION_DURATIONS = ["DAYS_1", "DAYS_3", "DAYS_5", "DAYS_7", "DAYS_10"];

export function validateEbayListing(form: EbayListingFormState): EbayListingErrors {
  const errors: EbayListingErrors = {};

  // Title — required, eBay hard limit is 80 chars
  if (!form.title_override?.trim()) {
    errors.title_override = "Listing title is required.";
  } else if (form.title_override.length > 80) {
    errors.title_override = "Title must be 80 characters or fewer (eBay limit).";
  }

  // Category — required by eBay to publish
  if (!form.ebay_category_id?.trim()) {
    errors.ebay_category_id = "eBay category is required.";
  }

  // Photos — eBay requires at least 1 image, max 24
  const imageCount = (form.photo_overrides || []).filter((p) => p.type === "image").length;
  if (imageCount === 0) {
    errors.photo_overrides = "At least 1 image is required by eBay.";
  } else if (imageCount > 24) {
    errors.photo_overrides = "Maximum 24 images allowed by eBay.";
  }

  // Price — required and must be > 0
  const price = Number(form.price_override);
  if (!form.price_override || isNaN(price) || price <= 0) {
    errors.price_override = "A valid price greater than A$0 is required.";
  }

  // Quantity — if provided must be a whole number >= 1
  if (form.quantity_available !== "" && form.quantity_available !== null) {
    const qty = Number(form.quantity_available);
    if (isNaN(qty) || qty < 1 || !Number.isInteger(qty)) {
      errors.quantity_available = "Quantity must be a whole number of 1 or more.";
    }
  }

  // Auction-specific: GTC not valid; Best Offer not available for auctions
  if (form.format === "AUCTION") {
    if (!form.listing_duration || !AUCTION_DURATIONS.includes(form.listing_duration)) {
      errors.listing_duration = "Auctions must have a fixed duration (1, 3, 5, 7 or 10 days) — not Good 'Til Cancelled.";
    }
    if (form.accept_best_offer) {
      errors.accept_best_offer = "Best Offer is not available for auction format.";
    }
  }

  // Brand/MPN pairing — either both or neither (MPN "Does Not Apply" satisfies the requirement)
  const brand = form.item_specifics?.brand?.trim();
  const mpn = form.item_specifics?.mpn?.trim();
  if (brand && !mpn) {
    errors.item_specifics = "MPN is required when Brand is set (use \"Does Not Apply\" if unknown).";
  } else if (mpn && mpn !== "Does Not Apply" && !brand) {
    errors.item_specifics = "Brand is required when MPN is set.";
  }

  // Best offer minimum must be less than the Buy It Now price
  if (form.accept_best_offer && form.min_best_offer) {
    const min = Number(form.min_best_offer);
    if (isNaN(min) || min <= 0) {
      errors.min_best_offer = "Minimum best offer must be greater than A$0.";
    } else if (!isNaN(price) && price > 0 && min >= price) {
      errors.min_best_offer = "Minimum best offer must be less than the listing price.";
    }
  }

  // Shipping policy — required for eBay to publish
  if (!form.fulfillment_policy_id?.trim()) {
    errors.fulfillment_policy_id = "A shipping policy is required.";
  }

  // Payment policy — required
  if (!form.payment_policy_id?.trim()) {
    errors.payment_policy_id = "A payment policy is required.";
  }

  // Return policy — required
  if (!form.return_policy_id?.trim()) {
    errors.return_policy_id = "A return policy is required.";
  }

  // Package dimensions — if any dimension is filled, all three are required together
  const pkg = form.package;
  const hasDim = pkg.length || pkg.width || pkg.height;
  if (hasDim) {
    const allFilled = pkg.length && pkg.width && pkg.height;
    if (!allFilled) {
      errors.package = "Provide all three dimensions (length, width, height) or leave all blank.";
    } else {
      const dims = [Number(pkg.length), Number(pkg.width), Number(pkg.height)];
      if (dims.some((d) => isNaN(d) || d <= 0)) {
        errors.package = "Package dimensions must be positive numbers.";
      }
    }
  }
  if (pkg.weight) {
    const w = Number(pkg.weight);
    if (isNaN(w) || w <= 0) {
      errors.package = "Package weight must be a positive number.";
    }
  }

  return errors;
}

export function hasEbayErrors(errors: EbayListingErrors): boolean {
  return Object.keys(errors).length > 0;
}
