export const KPIS = [
  { label: "Total Inventory", value: 48231, delta: "+2.6%", tone: "ok" as const },
  { label: "Active Listings", value: 1298, delta: "+4.1%", tone: "ok" as const },
  { label: "Orders Today", value: 74, delta: "+8.3%", tone: "ok" as const },
  { label: "Low Stock Items", value: 19, delta: "+3", tone: "warn" as const },
];

export const SALES_SERIES = [
  { day: "Mon", value: 14_200 },
  { day: "Tue", value: 18_450 },
  { day: "Wed", value: 16_980 },
  { day: "Thu", value: 22_110 },
  { day: "Fri", value: 26_540 },
  { day: "Sat", value: 20_300 },
  { day: "Sun", value: 24_880 },
];

export const ACTIVITY = [
  { at: "2m ago", text: "eBay sync completed for 48 listings." },
  { at: "14m ago", text: "Low stock alert: Oil Filter (PPS-OF-2201)." },
  { at: "1h ago", text: "Order #PPG-10492 marked as shipped." },
  { at: "3h ago", text: "New product added: Timing Belt Kit (PPS-TBK-7810)." },
  { at: "Yesterday", text: "Supplier pricing update applied to 12 SKUs." },
];
