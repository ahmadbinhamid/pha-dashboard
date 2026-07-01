export type MarketplacePlatform = "ebay" | "amazon" | "shopify";
export type ListingState = "draft" | "active" | "ended";
export type ListingSyncStatus = "not_listed" | "pending" | "synced" | "out_of_stock" | "error";

export interface ItemSpecifics {
  brand: string | null;
  mpn: string | null;
  superseded_part_number: string[];
}

export interface FitmentRow {
  make: string;
  model: string;
  model_code: string;
  year_from: number | null;
  year_to: number | null;
}

export interface FitmentRowFormState {
  make: string;
  model: string;
  model_code: string;
  year_from: string;
  year_to: string;
}

export interface PackageDimensions {
  length: number | null;
  width: number | null;
  height: number | null;
  weight: number | null;
}

export interface MarketplaceListing {
  _id: string;
  id: string;
  platform: MarketplacePlatform;
  product: string | { _id: string; title: string; slug: string; sku: string | null; price: number };
  variant: string | null | { _id: string; display_name: string; sku: string | null };
  title_override: string | null;
  description_override: string | null;
  price_override: number | null;
  photo_overrides: import("@/types/product").Attachment[];
  state: ListingState;
  sync_status: ListingSyncStatus;
  synced_at: string | null;
  sync_error: string | null;
  external_listing_id: string | null;
  external_offer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EbayListing extends MarketplaceListing {
  platform: "ebay";
  ebay_category_id: string | null;
  store_category_id: string | null;
  store_sku: string | null;
  condition: string;
  condition_notes: string;
  item_specifics: ItemSpecifics;
  fitment: FitmentRow[];
  format: "FIXED_PRICE" | "AUCTION";
  quantity_available: number | null;
  listing_duration: string;
  accept_best_offer: boolean;
  min_best_offer: number | null;
  fulfillment_policy_id: string | null;
  payment_policy_id: string | null;
  return_policy_id: string | null;
  require_immediate_payment: boolean;
  item_location_zip: string | null;
  package: PackageDimensions;
}

// Form state — all numeric fields kept as strings to avoid controlled-input issues
export interface EbayListingFormState {
  product_id: string;
  variant_id: string;
  title_override: string;
  description_override: string;
  price_override: string;
  photo_overrides: import("@/types/product").Attachment[];
  // Vehicle info (pre-populated from product for description generation)
  vehicle_make: string;
  vehicle_model: string;
  vehicle_model_code: string;
  vehicle_year: string;
  // eBay-specific
  ebay_category_id: string;
  store_category_id: string;
  store_sku: string;
  condition: string;
  condition_notes: string;
  item_specifics: {
    brand: string;
    mpn: string;
    superseded_part_number: string[];
    aspects: Record<string, string>;
  };
  fitment: FitmentRowFormState[];
  format: "FIXED_PRICE" | "AUCTION";
  quantity_available: string;
  listing_duration: string;
  accept_best_offer: boolean;
  min_best_offer: string;
  fulfillment_policy_id: string;
  payment_policy_id: string;
  return_policy_id: string;
  require_immediate_payment: boolean;
  item_location_zip: string;
  package: {
    length: string;
    width: string;
    height: string;
    weight: string;
  };
}

export const EBAY_LISTING_FORM_INITIAL: EbayListingFormState = {
  product_id: "",
  variant_id: "",
  title_override: "",
  description_override: "",
  price_override: "",
  photo_overrides: [],
  vehicle_make: "",
  vehicle_model: "",
  vehicle_model_code: "",
  vehicle_year: "",
  ebay_category_id: "",
  store_category_id: "",
  store_sku: "",
  condition: "NEW",
  condition_notes: "",
  item_specifics: {
    brand: "",
    mpn: "",
    superseded_part_number: [""],
    aspects: {},
  },
  fitment: [],
  format: "FIXED_PRICE",
  quantity_available: "",
  listing_duration: "GTC",
  accept_best_offer: false,
  min_best_offer: "",
  fulfillment_policy_id: "",
  payment_policy_id: "",
  return_policy_id: "",
  require_immediate_payment: true,
  item_location_zip: "",
  package: { length: "", width: "", height: "", weight: "" },
};
