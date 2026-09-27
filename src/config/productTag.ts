import type { TagAlign, TagFieldKey, TagFieldStyle, TagFont, TagLineSpacing, TagQrPosition, TagStyle } from "@/types/tags";

// Printed tag: label stock size and the link its QR code opens.
export const PRODUCT_TAG_SIZE_MM = { width: 76, height: 25 } as const;

// NOTE: mobile app contract; it must register this scheme to open the product.
export const PRODUCT_TAG_DEEP_LINK_BASE = "autopartspro://product/";

export function productTagDeepLink(productId: string) {
  return `${PRODUCT_TAG_DEEP_LINK_BASE}${productId}`;
}

/** Product id from a scanned tag QR, or null for any other code. */
export function productIdFromTagLink(value: string): string | null {
  if (!value.startsWith(PRODUCT_TAG_DEEP_LINK_BASE)) return null;
  const id = value.slice(PRODUCT_TAG_DEEP_LINK_BASE.length).trim();
  return /^[a-f0-9]{24}$/i.test(id) ? id : null;
}

// Mirrors server constants/tag.constants.js; the server has the final say.
export const MAX_TAG_COPIES = 500;
export const TAG_FONT_PT = { min: 5, max: 14, step: 0.5 } as const;
export const TAG_MARGIN_MM = { min: 1, max: 4, step: 0.5 } as const;
export const TAG_BODY_FIELDS: readonly TagFieldKey[] = ["title", "note"];

export const DEFAULT_TAG_FIELDS: TagFieldStyle[] = [
  { key: "title", visible: true, size_pt: 8, bold: true },
  { key: "note", visible: true, size_pt: 6.5, bold: false },
  { key: "stock_number", visible: true, size_pt: 8.5, bold: true },
  { key: "bay", visible: true, size_pt: 7.5, bold: true },
];

export const DEFAULT_TAG_STYLE: TagStyle = {
  font: "helvetica",
  qr_position: "left",
  align: "left",
  line_spacing: "normal",
  margin_mm: 2,
  fields: DEFAULT_TAG_FIELDS,
};

export const TAG_FIELD_LABEL: Record<TagFieldKey, string> = {
  title: "Product title",
  note: "Note",
  stock_number: "Stock number",
  bay: "Bay",
};

export const TAG_FONT_OPTIONS: { value: TagFont; label: string }[] = [
  { value: "helvetica", label: "Sans (Helvetica)" },
  { value: "times", label: "Serif (Times)" },
  { value: "courier", label: "Mono (Courier)" },
];

export const TAG_QR_POSITION_OPTIONS: { value: TagQrPosition; label: string }[] = [
  { value: "left", label: "QR on the left" },
  { value: "right", label: "QR on the right" },
];

export const TAG_ALIGN_OPTIONS: { value: TagAlign; label: string }[] = [
  { value: "left", label: "Left aligned" },
  { value: "center", label: "Centred" },
];

export const TAG_LINE_SPACING_OPTIONS: { value: TagLineSpacing; label: string }[] = [
  { value: "tight", label: "Tight" },
  { value: "normal", label: "Normal" },
  { value: "relaxed", label: "Relaxed" },
];

export const TAG_LINE_HEIGHT: Record<TagLineSpacing, number> = { tight: 1.05, normal: 1.15, relaxed: 1.3 };
