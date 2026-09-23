import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { CategoryMapping, CategoryMappingOverview, ProductMappedCategories } from "@/types/categoryMapping";

export const getCategoryMappingOverview = async () => {
  const { data } = await apiClient.get<BeResponse<CategoryMappingOverview>>("/category-mappings");
  return data;
};

export const saveCategoryMapping = async (
  categoryId: string,
  platform: string,
  body: { external_category_id: string; external_category_name?: string | null },
) => {
  const { data } = await apiClient.put<BeResponse<CategoryMapping>>(`/category-mappings/${categoryId}/${platform}`, body);
  return data;
};

export const deleteCategoryMapping = async (categoryId: string, platform: string) => {
  const { data } = await apiClient.delete<BeResponse<null>>(`/category-mappings/${categoryId}/${platform}`);
  return data;
};

// Category defaults the product form's channel panels fall back to.
export const getProductMappedCategories = async (productId: string) => {
  const { data } = await apiClient.get<BeResponse<ProductMappedCategories>>(`/category-mappings/products/${productId}`);
  return data;
};
