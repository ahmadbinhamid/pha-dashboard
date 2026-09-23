// Response shapes for /reports/*, mirrors reports.service.js. Money is cents everywhere (types/dashboard.ts convention), converted from dollars server-side.

export interface ReportsDateRangeParams {
  days?: number;
  from?: string;
  to?: string;
}

export interface ReportsSummary {
  range: { from: string; to: string; days: number };
  revenueCents: number;
  revenueChangePct: number | null;
  orders: number;
  ordersChangePct: number | null;
  itemsSold: number;
  itemsSoldChangePct: number | null;
  avgOrderValueCents: number;
  avgOrderValueChangePct: number | null;
  grossProfitCents: number;
  grossProfitChangePct: number | null;
  // One entry per day in `range` — feeds each metric card's sparkline.
  dailyRevenueCents: number[];
  dailyOrders: number[];
  dailyItemsSold: number[];
  dailyGrossProfitCents: number[];
}

export interface RevenueByChannelRow {
  channel: string;
  revenueCents: number;
  pct: number;
}

export interface TopCategoryRow {
  categoryId: string | null;
  name: string;
  revenueCents: number;
  pct: number;
}

export interface SalesPerformanceRow {
  channel: string;
  revenueCents: number;
  orders: number;
  itemsSold: number;
  avgOrderValueCents: number;
  grossProfitCents: number;
  trendPct: number | null;
}

export interface InventoryTurnoverPoint {
  date: string; // yyyy-mm-dd
  unitsMoved: number;
  cogsCents: number;
  turnoverRate: number;
  daysOfInventory: number;
  // Keyed by category name — only categories with orders in the window appear.
  categoryRates: Record<string, number>;
}

export interface InventoryTurnoverCategoryRanking {
  name: string;
  turnoverRate: number;
  daysOfInventory: number;
}

export interface InventoryTurnoverResponse {
  points: InventoryTurnoverPoint[];
  categoryRanking: InventoryTurnoverCategoryRanking[];
  summary: {
    avgTurnoverRate: number;
    avgDaysOfInventory: number;
    fastestCategory: InventoryTurnoverCategoryRanking | null;
    totalUnitsMoved: number;
    inventoryValueCents: number;
  };
}
