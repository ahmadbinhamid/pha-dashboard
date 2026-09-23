import type { InventoryAdjustType } from "@/types/inventory";

// Direction-dependent reason options for Adjust Stock, restricted to values the backend's Joi validator accepts (inventory.constants.js#ADJUSTMENT_TYPE). System-generated entries (eBay/Stripe/manual-sale) are never user-selectable here.
export const POSITIVE_ADJUST_REASONS: { value: InventoryAdjustType; label: string }[] = [
  { value: "restock", label: "Restock" },
  { value: "transfer_in", label: "Transfer In" },
  { value: "correction", label: "Correction" },
  { value: "other", label: "Other" },
];

export const NEGATIVE_ADJUST_REASONS: { value: InventoryAdjustType; label: string }[] = [
  { value: "damaged", label: "Damaged" },
  { value: "lost", label: "Lost" },
  { value: "stolen", label: "Stolen" },
  { value: "transfer_out", label: "Transfer Out" },
  { value: "correction", label: "Correction" },
  { value: "other", label: "Other" },
];
