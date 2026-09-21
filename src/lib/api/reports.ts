import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type {
  ReportsDateRangeParams,
  ReportsSummary,
  RevenueByChannelRow,
  TopCategoryRow,
  SalesPerformanceRow,
  InventoryTurnoverResponse,
} from "@/types/reports";

export const getReportsSummary = async (params: ReportsDateRangeParams) => {
  const { data } = await apiClient.get<BeResponse<ReportsSummary>>("/reports/summary", { params });
  return data;
};

export const getRevenueByChannel = async (params: ReportsDateRangeParams) => {
  const { data } = await apiClient.get<BeResponse<RevenueByChannelRow[]>>("/reports/revenue-by-channel", { params });
  return data;
};

export const getTopCategories = async (params: ReportsDateRangeParams & { limit?: number }) => {
  const { data } = await apiClient.get<BeResponse<TopCategoryRow[]>>("/reports/top-categories", { params });
  return data;
};

export const getSalesPerformance = async (params: ReportsDateRangeParams) => {
  const { data } = await apiClient.get<BeResponse<SalesPerformanceRow[]>>("/reports/sales-performance", { params });
  return data;
};

export const getInventoryTurnover = async (params: ReportsDateRangeParams) => {
  const { data } = await apiClient.get<BeResponse<InventoryTurnoverResponse>>("/reports/inventory-turnover", { params });
  return data;
};
