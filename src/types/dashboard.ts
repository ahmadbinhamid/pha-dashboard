export interface DashboardStats {
  totalInventoryValue: number; // dollars
  // % change in inventory value over 7 days; null with no baseline.
  inventoryValueChangePct: number | null;
  lowStockCount: number;
  outOfStockCount: number;
  pendingOrdersCount: number;
  pendingOrdersAvgAgeHours: number;
  // Successful / (successful + failed) listings; null when none has settled.
  syncStabilityPct: number | null;
  channelsOperational: number;
  channelsTotal: number;
}

export interface OrderVolumePoint {
  date: string; // yyyy-mm-dd
  orders: number;
  revenueCents: number;
  items: number;
  // Keyed by the ORDER_CHANNEL values present in this tenant's orders.
  byChannel: Record<string, number>;
}

export interface OrderVolumeResponse {
  points: OrderVolumePoint[];
  // Revenue for the same-length window before `points` (vs prior period).
  previousPeriodRevenueCents: number;
}

export type OrderVolumeMetric = "orders" | "revenueCents" | "items";

// Preset days or an explicit from/to range; from/to wins when both are set.
export interface OrderVolumeParams {
  days?: number;
  from?: string;
  to?: string;
}

// "not_connected" is a real integrated channel with no activity yet.
export type ChannelStatus = "operational" | "attention" | "not_connected";

export interface ChannelHealth {
  key: string;
  name: string;
  status: ChannelStatus;
  lastSyncedAt: string | null;
  detail?: string;
  listingsSynced?: number; // synced + out_of_stock (successful pushes)
  listingsFailed?: number; // error + price_locked, as on the Channel sync page
  listingsTotal?: number;
}

export type ActivityEventType = "order" | "stock";

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  title: string;
  description: string;
  // Stock events only: the adjusted SKU, shown on its own line.
  sku?: string | null;
  timestamp: string;
  tags: string[];
}

export interface CriticalStockItem {
  inventoryId: string;
  productId: string;
  sku: string;
  name: string;
  category: string | null;
  stockCount: number;
}

export interface ActivityLogPage {
  items: ActivityEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ActivityAnalyticsPoint {
  date: string; // yyyy-mm-dd
  orders: number;
  stock: number;
}

export interface ActivityAnalytics {
  totalEvents: number;
  orderEvents: number;
  stockEvents: number;
  dailyTrend: ActivityAnalyticsPoint[];
}
