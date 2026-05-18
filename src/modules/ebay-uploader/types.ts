/** Types for the eBay Uploader tool (formerly in services/ebay). */

export type EbayCondition =
  | "NEW"
  | "USED"
  | "NEW_OTHER"
  | "USED_EXCELLENT"
  | "USED_VERY_GOOD"
  | "USED_GOOD"
  | "USED_ACCEPTABLE";

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
  compatibilityText: string;
  fitmentRows: VehicleFitmentRow[];
  imageUrls: string[];
  ebayCategoryId: string;
};
