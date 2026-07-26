import type { InventoryAdjustType } from "@/types/inventory";

// Direction-dependent reason options for Adjust Stock — restricted to the
// values the backend's Joi validator actually accepts for a manual adjustment
// (server/src/constants/inventory.constants.js#ADJUSTMENT_TYPE). The eBay/
// Stripe/manual-sale entries in that enum are system-generated and never
// user-selectable here.
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
