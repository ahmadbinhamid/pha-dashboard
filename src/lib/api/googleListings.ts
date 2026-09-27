import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { GoogleChannelFormState, GoogleListing, GoogleListingFormState } from "@/types/marketplace";

// Google's "lightweight toggle" create, much smaller than eBay's createListing since most data comes from the product itself. Also queues the first sync server-side, unlike eBay's separate push step.
export const createGoogleListing = async (productId: string, variantId: string | null, form: GoogleListingFormState) => {
  const { data } = await apiClient.post<BeResponse<GoogleListing>>("/google/listings", {
    product: productId,
    variant: variantId,
    google_product_category: form.google_product_category || null,
    gtin: form.gtin || null,
    mpn: form.mpn || null,
    condition: form.condition || null,
    shipping_label: form.shipping_label || null,
  });
  return data;
};

// Sends overrides only when the form has them; empty becomes null (product value).
export const updateGoogleListing = async (id: string, form: GoogleListingFormState | GoogleChannelFormState) => {
  const overrides =
    "title_override" in form
      ? {
          title_override: form.title_override.trim() || null,
          description_override: form.description_override.trim() || null,
          price_override: form.price_override !== "" ? Number(form.price_override) : null,
        }
      : {};
  const { data } = await apiClient.put<BeResponse<GoogleListing>>(`/google/listings/${id}`, {
    google_product_category: form.google_product_category || null,
    gtin: form.gtin || null,
    mpn: form.mpn || null,
    condition: form.condition || null,
    shipping_label: form.shipping_label || null,
    ...overrides,
  });
  return data;
};
