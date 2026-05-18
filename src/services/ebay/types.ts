/**
 * Shared types for the internal eBay uploader tool.
 * Safe to import from client or server (no secrets).
 */

export type EbayCondition = "NEW" | "USED" | "NEW_OTHER" | "USED_EXCELLENT" | "USED_VERY_GOOD" | "USED_GOOD" | "USED_ACCEPTABLE";

export type VehicleFitmentRow = {
  id: string;
  make: string;
  model: string;
  year: string;
  engine: string;
};

export type EbayUploaderFormPayload = {
  title: string;
  sku: string;
  oemNumber: string;
  brand: string;
  condition: EbayCondition;
  price: string;
  quantity: string;
  description: string;
  /** Free-text compatibility lines (e.g. "Toyota Hilux 2018-2022") */
  compatibilityText: string;
  fitmentRows: VehicleFitmentRow[];
  /** Public HTTPS URLs eBay can fetch (required for live publish unless binary upload succeeds). */
  imageUrls: string[];
  /** Optional override; falls back to EBAY_DEFAULT_CATEGORY_ID server-side. */
  ebayCategoryId?: string;
};

export type CreateEbayListingResult =
  | {
      ok: true;
      dryRun: boolean;
      sku: string;
      offerId?: string;
      listingId?: string;
      warnings?: string[];
    }
  | {
      ok: false;
      code: string;
      message: string;
      details?: unknown;
    };
