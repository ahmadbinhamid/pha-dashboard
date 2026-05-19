import type { EbayCondition, EbayUploaderFormPayload, VehicleFitmentRow } from "@/types";

export const EBAY_UPLOADER_DRAFT_KEY = "pha-ebay-uploader-draft-v1";
export const EBAY_UPLOADER_LAST_KEY = "pha-ebay-uploader-last-v1";

export function emptyFitmentRow(): VehicleFitmentRow {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `row-${Date.now()}`,
    make: "",
    model: "",
    year: "",
    engine: "",
  };
}

export const DEFAULT_FORM: EbayUploaderFormPayload = {
  title: "",
  sku: "",
  oemNumber: "",
  brand: "",
  condition: "NEW",
  price: "",
  quantity: "1",
  description: "",
  compatibilityText: "",
  fitmentRows: [
    { id: "r1", make: "", model: "", year: "", engine: "" },
  ],
  imageUrls: [],
  ebayCategoryId: "",
};

export function suggestTitle(form: Pick<EbayUploaderFormPayload, "brand" | "title" | "oemNumber">): string {
  const brand = form.brand.trim();
  const oem = form.oemNumber.trim();
  if (form.title.trim()) return form.title.trim();
  if (brand && oem) return `${brand} — OEM ${oem}`;
  if (brand) return `${brand} automotive part`;
  return "";
}

export function conditionOptions(): { value: EbayCondition; label: string }[] {
  return [
    { value: "NEW", label: "New" },
    { value: "USED", label: "Used" },
    { value: "NEW_OTHER", label: "New other" },
    { value: "USED_EXCELLENT", label: "Used — excellent" },
    { value: "USED_VERY_GOOD", label: "Used — very good" },
    { value: "USED_GOOD", label: "Used — good" },
    { value: "USED_ACCEPTABLE", label: "Used — acceptable" },
  ];
}
