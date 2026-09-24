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

// Per-channel create/save glue for the product form (no generic create route).

export type ChannelFormState = EbayListingFormState | GoogleChannelFormState;

export interface ChannelFormAdapter {
  // First-listing seed; overrides stay empty so product fields stay live.
  initialForm(product: Product): ChannelFormState;
  fromListing(listing: AnyMarketplaceListing): ChannelFormState;
  // Same calls as the old "list" action; resolves to the new listing id.
  create(product: Product, form: ChannelFormState): Promise<string>;
  // Save, then queue a sync via the existing push endpoint.
  saveAndSync(listingId: string, form: ChannelFormState): Promise<void>;
  supportsPhotoOverrides: boolean;
}

// Keeps the created listing's id when the follow-up push is rejected.
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
  // NOTE: condition/MPN/category left empty to inherit live; SKU is identity.
  initialForm: (product) => ({
    ...EBAY_LISTING_FORM_INITIAL,
    product_id: product._id,
    store_sku: product.sku ?? "",
    condition: "",
    item_specifics: {
      ...EBAY_LISTING_FORM_INITIAL.item_specifics,
      authenticity: product.authenticity ?? "",
    },
  }),
  fromListing: (listing) => listingToForm(listing as EbayListing),
  // Old flow: create a DRAFT, then push (validates + queues).
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
  // Create queues a sync too; overrides aren't accepted on create, so save after.
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
