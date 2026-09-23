import type { Product } from "@/types/product";
import {
  EBAY_LISTING_FORM_INITIAL,
  GOOGLE_CHANNEL_FORM_INITIAL,
  type AnyMarketplaceListing,
  type EbayListing,
  type EbayListingFormState,
  type GoogleChannelFormState,
} from "@/types/marketplace";
import { createListing, pushListing, updateListing } from "@/lib/api/listings";
import { createGoogleListing, updateGoogleListing } from "@/lib/api/googleListings";
import { listingToForm } from "@/lib/marketplace/listingToForm";

// Per-channel glue between the product form's schema-driven panel and each platform's own
// listing endpoints (there is no generic create route). A channel with no adapter here is
// shown in Sales Channels but can't be ticked from the product form yet.

export type ChannelFormState = EbayListingFormState | GoogleChannelFormState;

export interface ChannelFormAdapter {
  // Seed for a first listing. Overrides stay empty so every product field stays live.
  initialForm(product: Product): ChannelFormState;
  fromListing(listing: AnyMarketplaceListing): ChannelFormState;
  // The same calls the old per-channel "list" action made; resolves to the new listing id.
  create(product: Product, form: ChannelFormState): Promise<string>;
  // Save the panel, then queue a sync through the existing push endpoint.
  saveAndSync(listingId: string, form: ChannelFormState): Promise<void>;
  supportsPhotoOverrides: boolean;
}

// Carries the created listing's id when the follow-up push is rejected (e.g. a 422), so the
// UI can show the listing as created-but-not-live instead of losing track of it.
export type ChannelApiError = Error & { status?: number; errors?: Array<{ field: string; message: string }> };

export class ChannelPushError extends Error {
  listingId: string;
  pushError: ChannelApiError;

  constructor(listingId: string, pushError: ChannelApiError) {
    super(pushError.message);
    this.listingId = listingId;
    this.pushError = pushError;
  }
}

async function pushOrThrow(listingId: string) {
  try {
    await pushListing(listingId);
  } catch (err) {
    throw new ChannelPushError(listingId, err as ChannelApiError);
  }
}

const ebayAdapter: ChannelFormAdapter = {
  // NOTE: seeds the eBay-only fields exactly as the old ListingCreatePage did (SKU, condition,
  // MPN, authenticity). The category is left empty so the tenant's mapping stays live.
  initialForm: (product) => ({
    ...EBAY_LISTING_FORM_INITIAL,
    product_id: product._id,
    store_sku: product.sku ?? "",
    condition: product.condition || EBAY_LISTING_FORM_INITIAL.condition,
    item_specifics: {
      ...EBAY_LISTING_FORM_INITIAL.item_specifics,
      mpn: product.mpn ?? "",
      authenticity: product.authenticity ?? "",
    },
  }),
  fromListing: (listing) => listingToForm(listing as EbayListing),
  // Old flow: POST /ebay/listings (DRAFT) then POST /listings/:id/push (validates + queues).
  create: async (_product, form) => {
    const { data } = await createListing(form as EbayListingFormState);
    await pushOrThrow(data._id);
    return data._id;
  },
  saveAndSync: async (listingId, form) => {
    await updateListing(listingId, form as EbayListingFormState);
    await pushOrThrow(listingId);
  },
  supportsPhotoOverrides: true,
};

function hasOverrides(form: GoogleChannelFormState) {
  return !!(form.title_override.trim() || form.description_override.trim() || form.price_override !== "");
}

const googleAdapter: ChannelFormAdapter = {
  initialForm: () => ({ ...GOOGLE_CHANNEL_FORM_INITIAL }),
  fromListing: (listing) =>
    listing.platform === "google"
      ? {
          google_product_category: listing.google_product_category ?? "",
          gtin: listing.gtin ?? "",
          mpn: listing.mpn ?? "",
          condition: listing.condition ?? "",
          shipping_label: listing.shipping_label ?? "",
          title_override: listing.title_override ?? "",
          description_override: listing.description_override ?? "",
          price_override: listing.price_override != null ? String(listing.price_override) : "",
        }
      : { ...GOOGLE_CHANNEL_FORM_INITIAL },
  // Old flow: POST /google/listings creates AND queues the first sync. Its create body takes
  // no overrides, so any set before ticking are saved right after (and re-queued).
  create: async (product, form) => {
    const googleForm = form as GoogleChannelFormState;
    const { data } = await createGoogleListing(product._id, null, googleForm);
    if (hasOverrides(googleForm)) {
      await updateGoogleListing(data._id, googleForm);
      await pushOrThrow(data._id);
    }
    return data._id;
  },
  saveAndSync: async (listingId, form) => {
    await updateGoogleListing(listingId, form as GoogleChannelFormState);
    await pushOrThrow(listingId);
  },
  supportsPhotoOverrides: false,
};

export const CHANNEL_FORM_ADAPTERS: Record<string, ChannelFormAdapter> = {
  ebay: ebayAdapter,
  google: googleAdapter,
};
