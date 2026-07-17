import type { ListingSyncStatus } from "@/types/marketplace";

export interface SyncStatusBreakdownItem {
  status: ListingSyncStatus;
  count: number;
}

export interface RevenueTrendPoint {
  date: string; // yyyy-mm-dd
  totalCents: number;
}
