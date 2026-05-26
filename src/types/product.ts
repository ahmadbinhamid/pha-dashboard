export type ProductType = 1 | 2; // 1=physical, 2=digital
export type ProductStatus = 0 | 1; // 0=draft, 1=active
export type EbaySyncStatus = "not_listed" | "pending" | "synced" | "error";

export interface Attachment {
  id: string;
  _id: string;
  uid: string;
  file_name: string;
  original_name: string;
  mime_type: string;
  size: number;
  url: string;
  type: "image" | "file";
}

export interface Category {
  _id: string;
  id: string;
  name: string;
  slug: string;
  parent: string | null;
  sort_order: number;
}

export interface Location {
  _id: string;
  id: string;
  name: string;
  address?: string;
  is_active: boolean;
}

export interface ProductVariant {
  _id: string;
  id: string;
  product: string;
  combination: Array<{ option: string; value: string }>;
  display_name: string;
  price: number;
  compare_price: number | null;
  cost_price: number | null;
  sku: string | null;
  barcode: string | null;
  is_active: boolean;
  attachments: Attachment[];
  digital_file: Attachment | null;
  ebay_listing_id: string | null;
  ebay_sync_status: EbaySyncStatus;
}

export interface Product {
  _id: string;
  id: string;
  title: string;
  slug: string;
  description: string;
  type: ProductType;
  status: ProductStatus;
  is_published_online: boolean;
  price: number;
  compare_price: number | null;
  cost_price: number | null;
  is_taxable: boolean;
  is_vat_inclusive: boolean;
  vat_rate: number | null;
  sku: string | null;
  barcode: string | null;
  stock_control: boolean;
  has_variants: boolean;
  brand: string | null;
  attachments: Attachment[];
  categories: Category[];
  tags: string[];
  related_products: Product[];
  choices: Array<{ name: string; items: string[] }>;
  digital_file: Attachment | null;
  ebay_listing_id: string | null;
  ebay_sync_status: EbaySyncStatus;
  ebay_synced_at: string | null;
  created_at: string;
  updated_at: string;
}
