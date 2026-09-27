export type TagFont = "helvetica" | "times" | "courier";
export type TagQrPosition = "left" | "right";
export type TagAlign = "left" | "center";
export type TagLineSpacing = "tight" | "normal" | "relaxed";
export type TagPrintSource = "queue" | "product";
export type TagQueueMode = "set" | "increment";
export type TagFieldKey = "title" | "note" | "stock_number" | "bay";

export interface TagFieldStyle {
  key: TagFieldKey;
  visible: boolean;
  size_pt: number;
  bold: boolean;
}

export interface TagStyle {
  font: TagFont;
  qr_position: TagQrPosition;
  align: TagAlign;
  line_spacing: TagLineSpacing;
  margin_mm: number;
  // Body fields print in this order; stock number and bay form the footer.
  fields: TagFieldStyle[];
}

// What a printed product tag needs; the server trims notes to the latest.
export interface TagProduct {
  _id: string;
  title: string;
  sku: string | null;
  bay: string | null;
  slug: string;
  note: string | null;
}

export interface TagQueueItem {
  _id: string;
  copies: number;
  added_by: string | null;
  created_at: string;
  product: TagProduct;
  stock_count: number;
}

export interface TagPrintedItem {
  product: string;
  sku: string | null;
  title: string;
  bay: string | null;
  copies: number;
}

export interface TagPrintLog {
  _id: string;
  source: TagPrintSource;
  printed_by: string | null;
  items: TagPrintedItem[];
  total_tags: number;
  created_at: string;
}

export interface TagPrintHistoryPage {
  items: TagPrintLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TagImportResult {
  added: number;
  skipped_out_of_stock: number;
}

// What one printed tag shows, already resolved from a product.
export interface TagContent {
  link: string;
  title: string;
  note: string | null;
  stockNumber: string | null;
  bay: string | null;
}

export interface TagPrintJob {
  content: TagContent;
  copies: number;
}

export interface TagTextBlock {
  key: TagFieldKey;
  lines: string[];
  pt: number;
  bold: boolean;
}

export interface TagLayout {
  margin: number;
  qrSize: number;
  textWidth: number;
  lineHeight: number;
  body: TagTextBlock[];
  footer: { stock: TagTextBlock | null; bay: TagTextBlock | null } | null;
  footerBaseline: number;
  ruleY: number;
}

// A product's tags in a print run: what to print and what to log.
export interface TagPrintItem {
  productId: string;
  label: string;
  content: TagContent;
  copies: number;
}
