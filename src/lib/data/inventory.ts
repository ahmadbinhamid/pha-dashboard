export type EbaySyncStatus = "synced" | "pending" | "error" | "not_listed";

export type InventoryItem = {
  id: string;
  image: { alt: string; initials: string; hue: number };
  /** Primary photo for PDP / tiles; when missing, UI uses the initials tile. */
  imageUrl?: string;
  /** Additional photos shown in the product gallery. */
  galleryUrls?: string[];
  sku: string;
  title: string;
  category: string;
  /** Vehicle fitment (demo) */
  make: string;
  model: string;
  yearFrom: number;
  yearTo: number;
  stock: number;
  cost: number;
  price: number;
  ebay: EbaySyncStatus;
};

export const INVENTORY: InventoryItem[] = [
  {
    id: "p-001",
    image: { alt: "Brake Pad Set", initials: "BP", hue: 210 },
    imageUrl: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1200&q=80",
    galleryUrls: [
      "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1200&q=80",
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=80",
    ],
    sku: "PPG-BPS-1042",
    title: "Brake Pad Set",
    category: "Brakes",
    make: "Mercedes-Benz",
    model: "C-Class W205",
    yearFrom: 2015,
    yearTo: 2021,
    stock: 128,
    cost: 42.1,
    price: 79.95,
    ebay: "synced",
  },
  {
    id: "p-002",
    image: { alt: "Oil Filter", initials: "OF", hue: 28 },
    imageUrl: "https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=1200&q=80",
    galleryUrls: [
      "https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=1200&q=80",
      "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=1200&q=80",
    ],
    sku: "PPG-OF-2201",
    title: "Oil Filter",
    category: "Service",
    make: "BMW",
    model: "3 Series F30",
    yearFrom: 2012,
    yearTo: 2019,
    stock: 12,
    cost: 6.2,
    price: 14.5,
    ebay: "pending",
  },
  {
    id: "p-003",
    image: { alt: "Timing Belt Kit", initials: "TB", hue: 340 },
    imageUrl: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=1200&q=80",
    galleryUrls: [
      "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=1200&q=80",
      "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1200&q=80",
    ],
    sku: "PPG-TBK-7810",
    title: "Timing Belt Kit",
    category: "Engine",
    make: "Audi",
    model: "A4 B9",
    yearFrom: 2016,
    yearTo: 2023,
    stock: 0,
    cost: 128.0,
    price: 229.0,
    ebay: "error",
  },
  {
    id: "p-004",
    image: { alt: "Spark Plug (Iridium)", initials: "SP", hue: 190 },
    imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80",
    galleryUrls: [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80",
      "https://images.unsplash.com/photo-1581092160562-40aa08e66837?w=1200&q=80",
    ],
    sku: "PPG-SP-9007",
    title: "Spark Plug (Iridium)",
    category: "Ignition",
    make: "Toyota",
    model: "Camry XV70",
    yearFrom: 2018,
    yearTo: 2023,
    stock: 340,
    cost: 9.25,
    price: 19.99,
    ebay: "synced",
  },
  {
    id: "p-005",
    image: { alt: "Cabin Air Filter", initials: "CF", hue: 95 },
    imageUrl: "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=1200&q=80",
    galleryUrls: [
      "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=1200&q=80",
      "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=1200&q=80",
    ],
    sku: "PPG-CAF-3312",
    title: "Cabin Air Filter",
    category: "Service",
    make: "Volkswagen",
    model: "Golf Mk7",
    yearFrom: 2013,
    yearTo: 2020,
    stock: 58,
    cost: 7.8,
    price: 18.0,
    ebay: "not_listed",
  },
];
