export type BundleItem = { sku: string; qty: number };

export type Bundle = {
  id: string;
  name: string;
  items: BundleItem[];
  bundlePriceAud?: number;
  ebayTitle?: string;
  ebayCategory?: string;
  createdAt: string;
};
