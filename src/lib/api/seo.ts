import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type {
  Article,
  ArticlePayload,
  ArticleTag,
  CategorySeoRow,
  ContentPage,
  ContentPagePayload,
  ContentStatus,
  ProductSeoRow,
  Redirect,
  RedirectPayload,
  SeoMeta,
  SeoOverview,
  SeoSettings,
  SeoSettingsPayload,
} from "@/types/seo";

interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const SEO_QUERY_KEY = ["seo"] as const;
export const articleQueryKey = (id: string) => [...SEO_QUERY_KEY, "article", id] as const;
export const pageQueryKey = (id: string) => [...SEO_QUERY_KEY, "page", id] as const;
export const SEO_SETTINGS_QUERY_KEY = [...SEO_QUERY_KEY, "settings"] as const;

export const getSeoOverview = async () => (await apiClient.get<BeResponse<SeoOverview>>("/seo/overview")).data;

export const getSeoSettings = async () => (await apiClient.get<BeResponse<SeoSettings>>("/seo/settings")).data;

export const updateSeoSettings = async (payload: SeoSettingsPayload) =>
  (await apiClient.put<BeResponse<SeoSettings>>("/seo/settings", payload)).data;

// Articles

export const getArticles = async (params: { page: number; limit: number; search?: string; status?: ContentStatus; tag?: string }) =>
  (await apiClient.get<BeResponse<Paged<Article>>>("/seo/articles", { params })).data;

export const getArticleTags = async () => (await apiClient.get<BeResponse<ArticleTag[]>>("/seo/articles/tags")).data;

export const getArticle = async (id: string) => (await apiClient.get<BeResponse<Article>>(`/seo/articles/${id}`)).data;

export const createArticle = async (payload: ArticlePayload) =>
  (await apiClient.post<BeResponse<Article>>("/seo/articles", payload)).data;

export const updateArticle = async (id: string, payload: ArticlePayload) =>
  (await apiClient.patch<BeResponse<Article>>(`/seo/articles/${id}`, payload)).data;

export const deleteArticle = async (id: string) =>
  (await apiClient.delete<BeResponse<{ _id: string }>>(`/seo/articles/${id}`)).data;

// Pages

export const getContentPages = async (params: { search?: string; status?: ContentStatus }) =>
  (await apiClient.get<BeResponse<ContentPage[]>>("/seo/pages", { params })).data;

export const getContentPage = async (id: string) => (await apiClient.get<BeResponse<ContentPage>>(`/seo/pages/${id}`)).data;

export const createContentPage = async (payload: ContentPagePayload) =>
  (await apiClient.post<BeResponse<ContentPage>>("/seo/pages", payload)).data;

export const updateContentPage = async (id: string, payload: ContentPagePayload) =>
  (await apiClient.patch<BeResponse<ContentPage>>(`/seo/pages/${id}`, payload)).data;

export const deleteContentPage = async (id: string) =>
  (await apiClient.delete<BeResponse<{ _id: string }>>(`/seo/pages/${id}`)).data;

// Redirects

export const getRedirects = async (params: { page: number; limit: number; search?: string }) =>
  (await apiClient.get<BeResponse<Paged<Redirect>>>("/seo/redirects", { params })).data;

export const createRedirect = async (payload: RedirectPayload) =>
  (await apiClient.post<BeResponse<Redirect>>("/seo/redirects", payload)).data;

export const updateRedirect = async (id: string, payload: RedirectPayload) =>
  (await apiClient.patch<BeResponse<Redirect>>(`/seo/redirects/${id}`, payload)).data;

export const deleteRedirect = async (id: string) =>
  (await apiClient.delete<BeResponse<{ _id: string }>>(`/seo/redirects/${id}`)).data;

// Catalogue SEO

type CatalogParams = { page: number; limit: number; search?: string; missing?: boolean };

export const getProductSeo = async (params: CatalogParams) =>
  (await apiClient.get<BeResponse<Paged<ProductSeoRow>>>("/seo/catalog/products", { params })).data;

export const updateProductSeo = async (id: string, seo: Partial<SeoMeta>) =>
  (await apiClient.patch<BeResponse<ProductSeoRow>>(`/seo/catalog/products/${id}`, seo)).data;

export const getCategorySeo = async (params: CatalogParams) =>
  (await apiClient.get<BeResponse<Paged<CategorySeoRow>>>("/seo/catalog/categories", { params })).data;

export const updateCategorySeo = async (id: string, seo: Partial<SeoMeta>) =>
  (await apiClient.patch<BeResponse<CategorySeoRow>>(`/seo/catalog/categories/${id}`, seo)).data;
