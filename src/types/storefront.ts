import type { DiscountPayload, FeaturedDiscount } from "@/types/discount";

export type HeroAlign = "left" | "center" | "right";
export type HeroVertical = "top" | "center" | "bottom";
// Light text for dark photos, dark text for light ones.
export type HeroTextTone = "light" | "dark";
export type HeroImageFocus = "center" | "top" | "bottom" | "left" | "right";
export type HeroHeight = "compact" | "standard" | "tall";
export type AnnouncementTheme = "indigo" | "crimson" | "amber" | "emerald" | "carbon" | "custom";
export type AnnouncementIcon = "none" | "sparkles" | "truck" | "tag" | "zap" | "gift";
export type BannerPlacement = "all_pages" | "home_only";
export type TickerSpeed = "slow" | "normal" | "fast";
export type TickerTheme = "brand" | "crimson" | "carbon" | "custom";
export type SimulatorDevice = "desktop" | "tablet" | "mobile";

export interface HeroSlide {
  // Absent until the slide is first saved.
  _id?: string;
  title: string;
  subtitle: string;
  badge: string;
  cta_label: string;
  cta_url: string;
  secondary_cta_label: string;
  secondary_cta_url: string;
  image_url: string;
  // Optional phone crop, falls back to image_url.
  mobile_image_url: string;
  image_focus: HeroImageFocus;
  align: HeroAlign;
  vertical: HeroVertical;
  text_tone: HeroTextTone;
  overlay: number;
  // Optional window, outside it the slide is skipped even if active.
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
}

export interface HeroSettings {
  autoplay: boolean;
  interval_seconds: number;
  show_arrows: boolean;
  show_dots: boolean;
  height: HeroHeight;
}

export interface Announcement {
  enabled: boolean;
  message: string;
  link_url: string;
  link_label: string;
  theme: AnnouncementTheme;
  // Used when theme is "custom".
  bg_color: string;
  text_color: string;
  icon: AnnouncementIcon;
  dismissible: boolean;
  placement: BannerPlacement;
  starts_at: string | null;
  ends_at: string | null;
}

// How the promoted discount is shown, pricing lives on the discount.
export interface PromotionDisplay {
  ticker_speed: TickerSpeed;
  ticker_theme: TickerTheme;
  // Used when ticker_theme is "custom".
  ticker_bg_color: string;
  ticker_text_color: string;
  show_countdown: boolean;
  show_hero_card: boolean;
  show_product_badges: boolean;
}

// Features one Discount on the storefront.
export interface FlashSale extends PromotionDisplay {
  active: boolean;
  discount_id: string | null;
  ticker_text: string;
}

// The featured discount as shoppers see it: ticker, countdown, sale prices.
export interface PromotedSale
  extends PromotionDisplay,
    Pick<
    FeaturedDiscount,
    "name" | "code" | "is_automatic" | "discount_type" | "discount_value" | "scope" | "eligible_category_ids" | "ends_at"
  > {
  ticker_text: string;
}

export interface FlashSalePreset {
  id: string;
  emoji: string;
  label: string;
  durationDays: number;
  // Category names matching this get targeted, preset is off without one.
  categoryMatch?: RegExp;
  sale: Required<Pick<DiscountPayload, "name" | "discount_type" | "discount_value" | "scope">> & {
    code: string;
    ticker_text: string;
  };
}

// Body of POST /storefront/settings/flash-sale/launch.
export type FlashSaleLaunchPayload = FlashSalePreset["sale"] & { category_ids: string[]; ends_at: string };

export interface StorefrontSettings {
  hero_slides: HeroSlide[];
  hero_settings: HeroSettings;
  announcement: Announcement;
  flash_sale: FlashSale;
  // The discount flash_sale.discount_id points at, null if unset or deleted.
  featured_discount: FeaturedDiscount | null;
  updated_at: string | null;
}

// What the simulator renders: saved content overlaid with unsaved drafts.
export interface StorefrontPreviewContent {
  slides: HeroSlide[];
  heroSettings: HeroSettings;
  announcement: Announcement;
  // Null when nothing is featured or the discount isn't live.
  sale: PromotedSale | null;
}

export type StorefrontTab = "hero" | "announcement" | "flash-sale" | "discounts";
