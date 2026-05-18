/**
 * Demo-only fields for the ERP product detail screen. Merged with live `InventoryItem` from the store.
 */

export type ProductActivityItem = { at: string; text: string };

export type ProductViewExtras = {
  supplier: string;
  supplierSku: string;
  binLocation: string;
  weightKg: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  listingId: string | null;
  lastChannelSync: string;
  reorderPoint: number;
  reorderQty: number;
  warrantyMonths: number;
  countryOfOrigin: string;
  notes: string;
  activity: ProductActivityItem[];
  tags: string[];
};

const EXTRAS: Record<string, ProductViewExtras> = {
  "p-001": {
    supplier: "Bendix Australia Pty Ltd",
    supplierSku: "BDX-1042-OEM",
    binLocation: "A-12-04",
    weightKg: 3.2,
    lengthMm: 320,
    widthMm: 180,
    heightMm: 95,
    listingId: "ebay-284910552881",
    lastChannelSync: "Today, 09:14 AEDT",
    reorderPoint: 40,
    reorderQty: 120,
    warrantyMonths: 24,
    countryOfOrigin: "Australia",
    notes: "OEM-equivalent compound. Popular on Euro SUVs — keep seasonal promo stock.",
    activity: [
      { at: "Today, 09:14", text: "eBay quantity sync completed (live)." },
      { at: "Yesterday", text: "Cost price updated from supplier feed." },
      { at: "3 days ago", text: "Picked for order #PPG-10488." },
      { at: "1 week ago", text: "Stock receipt PO-2026-0142 (+60 units)." },
    ],
    tags: ["Brakes", "OEM-style", "Fast-moving"],
  },
  "p-002": {
    supplier: "Mann+Hummel APAC",
    supplierSku: "HU-7025z",
    binLocation: "B-03-01",
    weightKg: 0.45,
    lengthMm: 120,
    widthMm: 120,
    heightMm: 140,
    listingId: null,
    lastChannelSync: "Pending first publish",
    reorderPoint: 20,
    reorderQty: 100,
    warrantyMonths: 12,
    countryOfOrigin: "Germany",
    notes: "Awaiting eBay listing approval — photos need update.",
    activity: [
      { at: "2h ago", text: "Low stock alert triggered (≤15)." },
      { at: "Yesterday", text: "Draft listing saved to eBay Motors." },
      { at: "4 days ago", text: "Barcode label printed for shelf B-03-01." },
    ],
    tags: ["Service", "Filter", "Euro"],
  },
  "p-003": {
    supplier: "Gates Oceania",
    supplierSku: "K015603XS",
    binLocation: "C-08-02",
    weightKg: 1.8,
    lengthMm: 280,
    widthMm: 220,
    heightMm: 85,
    listingId: "ebay-284910559902",
    lastChannelSync: "Failed — see eBay message",
    reorderPoint: 5,
    reorderQty: 24,
    warrantyMonths: 36,
    countryOfOrigin: "USA",
    notes: "eBay sync error: fitment table mismatch on W204. Fix before next push.",
    activity: [
      { at: "Today, 07:02", text: "eBay API returned error 21919303 (fitment)." },
      { at: "Yesterday", text: "Manual stock adjustment to 0 (cycle count)." },
      { at: "2 weeks ago", text: "Kit contents verified at goods-in." },
    ],
    tags: ["Engine", "Kit", "Needs attention"],
  },
  "p-004": {
    supplier: "NGK Spark Plugs Australia",
    supplierSku: "ILKAR7B11",
    binLocation: "D-01-18",
    weightKg: 0.06,
    lengthMm: 22,
    widthMm: 22,
    heightMm: 95,
    listingId: "ebay-284910561004",
    lastChannelSync: "Today, 08:40 AEDT",
    reorderPoint: 80,
    reorderQty: 400,
    warrantyMonths: 12,
    countryOfOrigin: "Japan",
    notes: "Sold as singles; bundle of 4 common for 4-cyl services.",
    activity: [
      { at: "Today, 08:40", text: "Price pushed to eBay from ERP." },
      { at: "Yesterday", text: "Bulk import updated 12 SKUs in family." },
      { at: "5 days ago", text: "High velocity — auto reorder suggested." },
    ],
    tags: ["Ignition", "Iridium", "High volume"],
  },
  "p-005": {
    supplier: "Ryco Filters",
    supplierSku: "RCA187P",
    binLocation: "B-05-11",
    weightKg: 0.35,
    lengthMm: 240,
    widthMm: 200,
    heightMm: 40,
    listingId: null,
    lastChannelSync: "Not listed",
    reorderPoint: 25,
    reorderQty: 80,
    warrantyMonths: 12,
    countryOfOrigin: "Australia",
    notes: "Not on eBay yet — storefront only. Consider Motors listing Q3.",
    activity: [
      { at: "1 week ago", text: "Created in ERP from supplier spreadsheet." },
      { at: "2 weeks ago", text: "Photos uploaded (internal)." },
    ],
    tags: ["Cabin", "Seasonal"],
  },
};

const FALLBACK: ProductViewExtras = {
  supplier: "Demo Supplier Pty Ltd",
  supplierSku: "—",
  binLocation: "—",
  weightKg: 1,
  lengthMm: 100,
  widthMm: 100,
  heightMm: 100,
  listingId: null,
  lastChannelSync: "Never",
  reorderPoint: 10,
  reorderQty: 50,
  warrantyMonths: 12,
  countryOfOrigin: "Australia",
  notes: "No extended demo record for this SKU yet.",
  activity: [{ at: "Just now", text: "Product record opened in ERP (demo)." }],
  tags: ["New"],
};

export function getProductViewExtras(productId: string): ProductViewExtras {
  return EXTRAS[productId] ?? FALLBACK;
}
