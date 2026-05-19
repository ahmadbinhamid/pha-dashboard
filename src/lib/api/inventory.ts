import type { ApiResponse, PaginatedResponse } from "./base";
import type { InventoryItem } from "@/types";

export type InventoryListParams = {
  page?: number;
  search?: string;
  category?: string;
  make?: string;
  model?: string;
  year?: string;
  ebay?: string;
};

export type CreateInventoryItemInput = {
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
};

export type UpdateInventoryItemInput = Partial<CreateInventoryItemInput>;

// Stubs — implement once BE is ready
export async function getInventoryItems(
  _params: InventoryListParams = {},
): Promise<ApiResponse<PaginatedResponse<InventoryItem>>> {
  throw new Error("Not implemented — BE not finalized");
}

export async function createInventoryItem(
  _input: CreateInventoryItemInput,
): Promise<ApiResponse<{ item: InventoryItem }>> {
  throw new Error("Not implemented — BE not finalized");
}

export async function updateInventoryItem(
  _id: string,
  _input: UpdateInventoryItemInput,
): Promise<ApiResponse<{ item: InventoryItem }>> {
  throw new Error("Not implemented — BE not finalized");
}

export async function deleteInventoryItem(_id: string): Promise<ApiResponse> {
  throw new Error("Not implemented — BE not finalized");
}
