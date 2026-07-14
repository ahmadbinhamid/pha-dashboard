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
  description: string;
  thumbnail: Attachment | null;
  parent: string | null;
  sort_order: number;
}

// The /category endpoint now returns a paginated payload (matching
// ProductListData) instead of a bare Category[] array.
export interface CategoryListData {
  items: Category[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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

export type ProductCondition = "NEW" | "USED";
export type ProductAuthenticity = "Genuine" | "Aftermarket";

export interface ProductVehicle {
  make: string | null;
  model: string | null;
  model_code: string | null;
  year_from: number | null;
  year_to: number | null;
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
  sku: string | null;
  barcode: string | null;
  stock_control: boolean;
  has_variants: boolean;
  brand: string | null;
  condition: ProductCondition;
  authenticity: ProductAuthenticity | null;
  vehicle: ProductVehicle;
  attachments: Attachment[];
  categories: Category[];
  tags: string[];
  related_products: Product[];
  choices: Choice[];
  digital_file: Attachment | null;
  created_at: string;
  updated_at: string;
}

export interface StockEntry {
  location_id: string;
  location_name: string;
  qty: number;
}

export interface ProductCreateFormState {
  title: string;
  description: string;
  price: string;
  compare_price: string;
  cost_price: string;
  is_taxable: boolean;
  barcode: string;
  stock_control: boolean;
  stock_entries: StockEntry[];
  condition: ProductCondition;
  authenticity: ProductAuthenticity | "";
  vehicle_make: string;
  vehicle_model: string;
  vehicle_model_code: string;
  vehicle_year: string;
  vehicle_year_to: string;
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
  sku: string;
  barcode: string;
  brand: string;
  condition: ProductCondition;
  authenticity: ProductAuthenticity | "";
  vehicle_make: string;
  vehicle_model: string;
  vehicle_model_code: string;
  vehicle_year: string;
  vehicle_year_to: string;
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