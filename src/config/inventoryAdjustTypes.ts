import type { InventoryAdjustType } from "@/types/inventory";

export const ADJUST_TYPE_OPTIONS: { value: InventoryAdjustType; label: string }[] = [
  { value: "restock", label: "Restock" },
  { value: "correction", label: "Correction" },
  { value: "damaged", label: "Damaged" },
  { value: "lost", label: "Lost" },
  { value: "stolen", label: "Stolen" },
  { value: "transfer_in", label: "Transfer In" },
  { value: "transfer_out", label: "Transfer Out" },
  { value: "other", label: "Other" },
];
