export type EbaySyncStatus = "synced" | "pending" | "error" | "not_listed";

export type InventoryItem = {
  id: string;
  image: { alt: string; initials: string; hue: number };
  imageUrl?: string;
  galleryUrls?: string[];
  sku: string;
  title: string;
  category: string;
  make: string;
  model: string;
  yearFrom: number;
  yearTo: number;
  stock: number;
  cost: number;
  price: number;
  ebay: EbaySyncStatus;
};
