import { apiClient } from "./client";
import type { BeResponse, PaginatedData } from "./base";
import type {
  AnyMarketplaceListing,
  EbayListing,
  EbayListingFormState,
  MarketplacePlatform,
  ProductListingGroup,
} from "@/types/marketplace";

export interface ListingListParams {
  page?: number;
  limit?: number;
  product?: string;
  product_in?: string;
  platform?: MarketplacePlatform;
  state?: string;
  sync_status?: string;
  // Server expands to sync_status in [error, price_locked]; beats sync_status.
  needs_attention?: boolean;
  search?: string;
}

// Empty override => null (use product value); eBay description renders on BE.
function formStateToPayload(form: EbayListingFormState) {
  return {
    product: form.product_id,
    variant: form.variant_id || null,
    title_override: form.title_override.trim() || null,
    description_override: form.description_override.trim() || null,
    price_override: form.price_override !== "" ? Number(form.price_override) : null,
    ebay_category_id: form.ebay_category_id || null,
    store_category_id: form.store_category_id || null,
    store_sku: form.store_sku || null,
    // Empty = use the product's condition.
    condition: form.condition || null,
    condition_notes: form.condition_notes,
    item_specifics: {
      brand: form.item_specifics.brand || null,
      mpn: form.item_specifics.mpn || null,
      superseded_part_number: form.item_specifics.superseded_part_number.filter((s) => s.trim() !== ""),
      authenticity: form.item_specifics.authenticity || null,
      warranty: form.item_specifics.warranty || null,
    },
    fitment: form.fitment
      .filter((r) => r.make.trim() || r.model.trim())
      .map((r) => ({
        make: r.make.trim(),
        model: r.model.trim(),
        model_code: r.model_code.trim(),
        year_from: r.year_from !== "" ? Number(r.year_from) : null,
        year_to: r.year_to !== "" ? Number(r.year_to) : null,
      })),
    format: form.format,
    quantity_available: form.quantity_available !== "" ? Number(form.quantity_available) : null,
    listing_duration: form.listing_duration,
    accept_best_offer: form.accept_best_offer,
    min_best_offer: form.min_best_offer !== "" ? Number(form.min_best_offer) : null,
    fulfillment_policy_id: form.fulfillment_policy_id || null,
    payment_policy_id: form.payment_policy_id || null,
    return_policy_id: form.return_policy_id || null,
    photo_overrides: (form.photo_overrides || []).map((a) => a._id || a.id).filter(Boolean),
    require_immediate_payment: form.require_immediate_payment,
    item_location_zip: form.item_location_zip || null,
    package: {
      length: form.package.length !== "" ? Number(form.package.length) : null,
      width: form.package.width !== "" ? Number(form.package.width) : null,
      height: form.package.height !== "" ? Number(form.package.height) : null,
      weight: form.package.weight !== "" ? Number(form.package.weight) : null,
    },
  };
}

// eBay-specific fields (category, fitment, policies) keep /ebay/listings.
export const createListing = async (form: EbayListingFormState) => {
  const { data } = await apiClient.post<BeResponse<EbayListing>>("/ebay/listings", formStateToPayload(form));
  return data;
};

export const updateListing = async (id: string, form: EbayListingFormState) => {
  const { data } = await apiClient.put<BeResponse<EbayListing>>(`/ebay/listings/${id}`, formStateToPayload(form));
  return data;
};

// Browse/read/delete/push are platform-agnostic; /listings mixes platforms.
export const getListings = async (params: ListingListParams = {}) => {
  const { data } = await apiClient.get<BeResponse<PaginatedData<AnyMarketplaceListing>>>("/listings", { params });
  return data;
};

// Same endpoint grouped by product: one row per product, same query params.
export const getGroupedListings = async (params: ListingListParams = {}) => {
  const { data } = await apiClient.get<BeResponse<PaginatedData<ProductListingGroup>>>("/listings", {
    params: { ...params, group_by: "product" },
  });
  return data;
};

export const getListing = async (id: string) => {
  const { data } = await apiClient.get<BeResponse<AnyMarketplaceListing>>(`/listings/${id}`);
  return data;
};

export const deleteListing = async (id: string) => {
  const { data } = await apiClient.delete<BeResponse>(`/listings/${id}`);
  return data;
};

export const pushListing = async (id: string) => {
  const { data } = await apiClient.post<BeResponse<{ queued: boolean }>>(`/listings/${id}/push`);
  return data;
};
