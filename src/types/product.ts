export type ProductType = "physical" | "digital";
export type ProductStatus = "draft" | "active";
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
  type: "image" | "video" | "file";
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

export interface Choice {
  name: string;
  items: string[];
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
  choices: Choice[];
  digital_file: Attachment | null;
  ebay_listing_id: string | null;
  ebay_offer_id: string | null;
  ebay_category_id: string | null;
  ebay_condition: string;
  ebay_sync_status: EbaySyncStatus;
  ebay_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductCreateFormState {
  title: string;
  description: string;
  price: string;
  compare_price: string;
  cost_price: string;
  is_taxable: boolean;
  vat_rate: string;
  sku: string;
  type: ProductType;
  status: ProductStatus;
  is_published_online: boolean;
  categories: string[];
  tags: string[];
  images: Attachment[];
}

export interface ProductEditFormState {
  title: string;
  description: string;
  price: string;
  compare_price: string;
  cost_price: string;
  is_taxable: boolean;
  is_vat_inclusive: boolean;
  vat_rate: string;
  sku: string;
  barcode: string;
  brand: string;
  type: ProductType;
  status: ProductStatus;
  is_published_online: boolean;
  stock_control: boolean;
  has_variants: boolean;
  categories: string[];
  tags: string[];
  images: Attachment[];
  choices: Choice[];
}

export interface EbaySettings {
  merchant_location_key: string | null;
  fulfillment_policy_id: string | null;
  payment_policy_id: string | null;
  return_policy_id: string | null;
}

export interface EbayStatus {
  connected: boolean;
  reason?: string;
}
