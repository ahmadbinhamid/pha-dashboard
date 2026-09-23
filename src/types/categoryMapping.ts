// Shapes from /category-mappings.

export interface CategoryMapping {
  _id: string;
  product_category_id: string;
  platform: string;
  external_category_id: string;
  external_category_name: string | null;
  updated_at: string;
}

export interface ChannelCategoryOption {
  id: string;
  name: string;
}

export interface CategorySuggestion extends ChannelCategoryOption {
  // false => generic fallback, not a keyword match.
  matched: boolean;
}

export interface MappableCategory {
  _id: string;
  name: string;
  parent: string | null;
  suggestions: Record<string, CategorySuggestion>;
}

export interface CategoryMappingOverview {
  platforms: { key: string; name: string }[];
  categories: MappableCategory[];
  mappings: CategoryMapping[];
  google_categories: ChannelCategoryOption[];
}

// Where a listing's effective category came from.
export type CategorySource = "listing" | "mapping";

export interface MappedCategory {
  id: string;
  name: string | null;
  source: "mapping";
  product_category_id: string;
}

// Per-platform default for one product (null when unmapped).
export type ProductMappedCategories = Record<string, MappedCategory | null>;
