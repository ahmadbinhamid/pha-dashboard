import { apiClient } from "./client";
import type { BeResponse, PaginatedData } from "./base";
import type { EbayListing, EbayListingFormState } from "@/types/marketplace";

export interface ListingListParams {
  page?: number;
  limit?: number;
  product?: string;
  state?: string;
  sync_status?: string;
}

function formStateToPayload(form: EbayListingFormState) {
  return {
    product: form.product_id,
    variant: form.variant_id || null,
    title_override: form.title_override || null,
    description_override: form.description_override || null,
    price_override: form.price_override !== "" ? Number(form.price_override) : null,
    ebay_category_id: form.ebay_category_id || null,
    store_category_id: form.store_category_id || null,
    store_sku: form.store_sku || null,
    condition: form.condition,
    condition_notes: form.condition_notes,
    item_specifics: {
      brand: form.item_specifics.brand || null,
      mpn: form.item_specifics.mpn || null,
      superseded_part_number: form.item_specifics.superseded_part_number.filter((s) => s.trim() !== ""),
    },
    fitment: form.fitment
      .filter((r) => r.make.trim() || r.model.trim())
      .map((r) => ({
        make: r.make.trim(),
        model: r.model.trim(),
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

export const createListing = async (form: EbayListingFormState) => {
  const { data } = await apiClient.post<BeResponse<EbayListing>>(
    "/ebay/listings",
    formStateToPayload(form),
  );
  return data;
};

export const getListings = async (params: ListingListParams = {}) => {
  const { data } = await apiClient.get<BeResponse<PaginatedData<EbayListing>>>(
    "/ebay/listings",
    { params },
  );
  return data;
};

export const getListing = async (id: string) => {
  const { data } = await apiClient.get<BeResponse<EbayListing>>(`/ebay/listings/${id}`);
  return data;
};

export const updateListing = async (id: string, form: Partial<EbayListingFormState>) => {
  const payload = form as EbayListingFormState;
  const { data } = await apiClient.put<BeResponse<EbayListing>>(
    `/ebay/listings/${id}`,
    formStateToPayload(payload),
  );
  return data;
};

export const deleteListing = async (id: string) => {
  const { data } = await apiClient.delete<BeResponse>(`/ebay/listings/${id}`);
  return data;
};

export const pushListing = async (id: string) => {
  const { data } = await apiClient.post<BeResponse<{ queued: boolean }>>(
    `/ebay/listings/${id}/push`,
  );
  return data;
};
