export type StoreProduct = {
  slug: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  make: string;
  model: string;
  yearFrom: number;
  yearTo: number;
  engine: string;
  condition: "new" | "used";
  genuineType: "genuine" | "aftermarket";
  inStock: boolean;
  warehouse: string;
  priceAud: number;
  image: string;
  images: string[];
  description: string;
  compatibility: string[];
  shippingNote: string;
};

export type StoreTheme = {
  /** HSL components only, e.g. "216 100% 58%" */
  primary: string;
  primaryForeground: string;
};

export type StoreTenant = {
  id: string;
  slug: string;
  companyName: string;
  tagline: string;
  logoUrl: string | null;
  theme: StoreTheme;
  supportEmail: string;
  supportPhone: string;
  currency: "AUD";
  defaultWarehouse: string;
};

export type CatalogFilters = {
  q?: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: string;
  engine?: string;
  brand?: string;
  category?: string;
  condition?: string;
  genuineType?: string;
  inStock?: string;
  warehouse?: string;
  priceMin?: string;
  priceMax?: string;
};
