import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type {
  Product,
  ProductVariant,
  Category,
  CategoryListData,
  Location,
  Attachment,
} from "@/types/product";

export interface ProductListParams {
  page?: number;
  search?: string;
  status?: string;
  categories?: string;
  type?: string;
}

export interface ProductListData {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const getProducts = async (params: ProductListParams = {}) => {
  const { data } = await apiClient.get<BeResponse<ProductListData>>(
    "/product",
    { params },
  );
  return data;
};

export const getProduct = async (slug: string) => {
  const { data } = await apiClient.get<BeResponse<Product>>(`/product/${slug}`);
  return data;
};

export const createProduct = async (payload: FormData) => {
  const { data } = await apiClient.post<BeResponse<Product>>(
    "/product",
    payload,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return data;
};

export const updateProduct = async (id: string, payload: FormData) => {
  const { data } = await apiClient.put<BeResponse<Product>>(
    `/product/${id}`,
    payload,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return data;
};

export const deleteProduct = async (id: string) => {
  const { data } = await apiClient.delete<BeResponse>(`/product/${id}`);
  return data;
};

export const duplicateProduct = async (id: string) => {
  const { data } = await apiClient.post<BeResponse<Product>>(
    `/product/${id}/duplicate`,
  );
  return data;
};

export const getVariants = async (id: string) => {
  const { data } = await apiClient.get<BeResponse<ProductVariant[]>>(
    `/product/${id}/variants`,
  );
  return data;
};

export const updateVariant = async (
  id: string,
  variantId: string,
  payload: FormData,
) => {
  const { data } = await apiClient.put<BeResponse<ProductVariant>>(
    `/product/${id}/variants/${variantId}`,
    payload,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
};

export const getCategories = async () => {
  const { data } = await apiClient.get<BeResponse<CategoryListData>>("/category");
  return data;
};

export const getLocations = async () => {
  const { data } = await apiClient.get<BeResponse<Location[]>>("/location");
  return data;
};

export const uploadAttachments = async (files: File[]) => {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const { data } = await apiClient.post<BeResponse<Attachment[]>>(
    "/attachment",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return data;
};

export const deleteAttachment = async (id: string) => {
  const { data } = await apiClient.delete<BeResponse>(`/attachment/${id}`);
  return data;
};

export const getAttachments = async (
  params: { page?: number; limit?: number } = {},
) => {
  const { data } = await apiClient.get<
    BeResponse<{
      items: Attachment[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>
  >("/attachment", { params });
  return data;
};