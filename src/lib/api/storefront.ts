import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type { Announcement, FlashSale, FlashSaleLaunchPayload, HeroSettings, HeroSlide, StorefrontSettings } from "@/types/storefront";

export const STOREFRONT_SETTINGS_QUERY_KEY = ["storefront-settings"] as const;

export const getStorefrontSettings = async () => {
  const { data } = await apiClient.get<BeResponse<StorefrontSettings>>("/storefront/settings");
  return data;
};

export const updateHeroSlides = async (slides: HeroSlide[]) => {
  const { data } = await apiClient.put<BeResponse<StorefrontSettings>>("/storefront/settings/hero-slides", { slides });
  return data;
};

export const updateHeroSettings = async (payload: Partial<HeroSettings>) => {
  const { data } = await apiClient.patch<BeResponse<StorefrontSettings>>("/storefront/settings/hero-settings", payload);
  return data;
};

export const updateAnnouncement = async (payload: Partial<Announcement>) => {
  const { data } = await apiClient.patch<BeResponse<StorefrontSettings>>("/storefront/settings/announcement", payload);
  return data;
};

export const updateFlashSale = async (payload: Partial<FlashSale>) => {
  const { data } = await apiClient.patch<BeResponse<StorefrontSettings>>("/storefront/settings/flash-sale", payload);
  return data;
};

export const launchFlashSale = async (payload: FlashSaleLaunchPayload) => {
  const { data } = await apiClient.post<BeResponse<StorefrontSettings>>("/storefront/settings/flash-sale/launch", payload);
  return data;
};
