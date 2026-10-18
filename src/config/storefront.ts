import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Ban,
  Gift,
  Monitor,
  Smartphone,
  Sparkles,
  Tablet,
  Tag,
  Truck,
  Zap,
} from "lucide-react";
import type { SegmentedOption } from "@/components/ui/SegmentedControl";
import type {
  Announcement,
  AnnouncementIcon,
  AnnouncementTheme,
  BannerPlacement,
  FlashSalePreset,
  HeroAlign,
  HeroHeight,
  HeroImageFocus,
  HeroSettings,
  HeroSlide,
  HeroTextTone,
  HeroVertical,
  PromotionDisplay,
  SimulatorDevice,
  StorefrontTab,
  TickerSpeed,
  TickerTheme,
} from "@/types/storefront";

export const STOREFRONT_TABS: readonly StorefrontTab[] = ["hero", "announcement", "flash-sale", "discounts"];

export const MAX_HERO_SLIDES = 10;

export const EMPTY_ANNOUNCEMENT: Announcement = {
  enabled: false,
  message: "",
  link_url: "",
  link_label: "Shop now",
  theme: "indigo",
  bg_color: "#4f46e5",
  text_color: "#ffffff",
  icon: "sparkles",
  dismissible: false,
  placement: "all_pages",
  starts_at: null,
  ends_at: null,
};

export const HERO_OVERLAY = { min: 0, max: 80, default: 45 } as const;
export const HERO_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const HERO_AUTOPLAY_SECONDS = { min: 3, max: 15 } as const;

export const DEFAULT_HERO_SETTINGS: HeroSettings = {
  autoplay: true,
  interval_seconds: 6,
  show_arrows: true,
  show_dots: true,
  height: "standard",
};

export const HERO_VERTICAL_OPTIONS: SegmentedOption<HeroVertical>[] = [
  { value: "top", label: "Top", icon: AlignVerticalJustifyStart, iconOnly: true },
  { value: "center", label: "Middle", icon: AlignVerticalJustifyCenter, iconOnly: true },
  { value: "bottom", label: "Bottom", icon: AlignVerticalJustifyEnd, iconOnly: true },
];

export const HERO_TEXT_TONE_OPTIONS: SegmentedOption<HeroTextTone>[] = [
  { value: "light", label: "Light text" },
  { value: "dark", label: "Dark text" },
];

export const HERO_IMAGE_FOCUS_OPTIONS: { value: HeroImageFocus; label: string }[] = [
  { value: "center", label: "Centre" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

// Simulator heights by container query, mirroring the storefront's sizes.
export const HERO_HEIGHT_CLASS: Record<HeroHeight, string> = {
  compact: "h-48 @3xl:h-72",
  standard: "h-64 @3xl:h-96",
  tall: "h-80 @3xl:h-128",
};

export const HERO_HEIGHT_OPTIONS: SegmentedOption<HeroHeight>[] = [
  { value: "compact", label: "Compact" },
  { value: "standard", label: "Standard" },
  { value: "tall", label: "Tall" },
];

export const ANNOUNCEMENT_ICON_OPTIONS: SegmentedOption<AnnouncementIcon>[] = [
  { value: "none", label: "No icon", icon: Ban, iconOnly: true },
  { value: "sparkles", label: "Sparkles", icon: Sparkles, iconOnly: true },
  { value: "truck", label: "Delivery", icon: Truck, iconOnly: true },
  { value: "tag", label: "Tag", icon: Tag, iconOnly: true },
  { value: "zap", label: "Flash", icon: Zap, iconOnly: true },
  { value: "gift", label: "Gift", icon: Gift, iconOnly: true },
];

export const BANNER_PLACEMENT_OPTIONS: SegmentedOption<BannerPlacement>[] = [
  { value: "all_pages", label: "Every page" },
  { value: "home_only", label: "Home page only" },
];

export const DEFAULT_PROMOTION_DISPLAY: PromotionDisplay = {
  ticker_speed: "normal",
  ticker_theme: "brand",
  ticker_bg_color: "#dc2626",
  ticker_text_color: "#ffffff",
  show_countdown: true,
  show_hero_card: true,
  show_product_badges: true,
};

export const TICKER_SPEED_OPTIONS: SegmentedOption<TickerSpeed>[] = [
  { value: "slow", label: "Slow" },
  { value: "normal", label: "Normal" },
  { value: "fast", label: "Fast" },
];

// Seconds per marquee loop, longer is slower.
export const TICKER_DURATION_SECONDS: Record<TickerSpeed, number> = { slow: 60, normal: 35, fast: 18 };

// Background + text classes per preset, "custom" uses the picked colours.
export const TICKER_THEMES: { value: TickerTheme; label: string; className: string }[] = [
  { value: "brand", label: "Brand gradient", className: "bg-gradient-to-r from-danger via-accent to-danger text-danger-fg" },
  { value: "crimson", label: "Crimson", className: "bg-danger text-danger-fg" },
  { value: "carbon", label: "Carbon", className: "bg-luxury-ink text-accent-fg" },
  { value: "custom", label: "Custom", className: "" },
];

// CC0 (pd.w.org, Wikimedia) or Unsplash-licence photos, all hotlink-safe.
export const HERO_PHOTO_PRESETS = [
  {
    id: "brakes",
    label: "Performance Brakes",
    url: "https://pd.w.org/2025/12/34869495e5d916288.49416782-2048x1152.jpg",
  },
  {
    id: "turbo",
    label: "Twin-Scroll Turbos",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/1988_Toyota_Chaser_GT_Twin_Turbo_engine.jpg/1280px-1988_Toyota_Chaser_GT_Twin_Turbo_engine.jpg",
  },
  {
    id: "engines",
    label: "Recycled Engines & Gearboxes",
    url: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1600&q=80&auto=format&fit=crop",
  },
  {
    id: "exhaust",
    label: "Exhaust Systems",
    url: "https://live.staticflickr.com/446/31878431516_15ae66f90a_b.jpg",
  },
  {
    id: "warehouse",
    label: "Warehouse & Quality Bay",
    url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1600&q=80&auto=format&fit=crop",
  },
  {
    id: "suspension",
    label: "Racing Suspension",
    url: "https://pd.w.org/2026/01/400696f48a966b6c0.53962029-1536x2048.jpg",
  },
] as const;

export const HERO_ALIGN_OPTIONS: SegmentedOption<HeroAlign>[] = [
  { value: "left", label: "Align left", icon: AlignLeft, iconOnly: true },
  { value: "center", label: "Align centre", icon: AlignCenter, iconOnly: true },
  { value: "right", label: "Align right", icon: AlignRight, iconOnly: true },
];

export const EMPTY_HERO_SLIDE: HeroSlide = {
  title: "",
  subtitle: "",
  badge: "",
  cta_label: "Shop now",
  cta_url: "/products",
  secondary_cta_label: "",
  secondary_cta_url: "",
  image_url: HERO_PHOTO_PRESETS[0].url,
  mobile_image_url: "",
  image_focus: "center",
  align: "left",
  vertical: "center",
  text_tone: "light",
  overlay: HERO_OVERLAY.default,
  starts_at: null,
  ends_at: null,
  active: true,
};

// Classes are the strip's background + text pair, all theme tokens.
export const ANNOUNCEMENT_THEMES: { value: AnnouncementTheme; label: string; className: string }[] = [
  { value: "indigo", label: "Indigo Brand", className: "bg-cat-3 text-accent-fg" },
  { value: "crimson", label: "Crimson Sale", className: "bg-danger text-danger-fg" },
  { value: "amber", label: "Energy Amber", className: "bg-warn text-warn-fg" },
  { value: "emerald", label: "Eco Emerald", className: "bg-ok text-ok-fg" },
  { value: "carbon", label: "Carbon Black", className: "bg-luxury-ink text-accent-fg" },
  // Colours come from the pickers, applied inline.
  { value: "custom", label: "Custom", className: "" },
];

/** Class + inline colours for a strip, custom themes use the picked hex. */
export function announcementThemeStyle(a: Pick<Announcement, "theme" | "bg_color" | "text_color">) {
  if (a.theme === "custom") return { className: "", style: { backgroundColor: a.bg_color, color: a.text_color } };
  return { className: (ANNOUNCEMENT_THEMES.find((t) => t.value === a.theme) ?? ANNOUNCEMENT_THEMES[0]).className, style: undefined };
}

/** Same for the sale ticker. */
export function tickerThemeStyle(d: Pick<PromotionDisplay, "ticker_theme" | "ticker_bg_color" | "ticker_text_color">) {
  if (d.ticker_theme === "custom") return { className: "", style: { backgroundColor: d.ticker_bg_color, color: d.ticker_text_color } };
  return { className: (TICKER_THEMES.find((t) => t.value === d.ticker_theme) ?? TICKER_THEMES[0]).className, style: undefined };
}

export const FLASH_SALE_PRESETS: FlashSalePreset[] = [
  {
    id: "flash20",
    emoji: "⚡",
    label: "20% Flash Sale",
    durationDays: 3,
    sale: {
      name: "20% Flash Sale",
      code: "FLASH20",
      discount_type: "percent",
      discount_value: 20,
      scope: "storewide",
      ticker_text: "⚡ FLASH SALE: 20% off everything with code FLASH20",
    },
  },
  {
    id: "expressfree",
    emoji: "🚚",
    label: "Free Shipping Promo",
    durationDays: 7,
    sale: {
      name: "Free Express Shipping",
      code: "EXPRESSFREE",
      discount_type: "free_shipping",
      discount_value: 0,
      scope: "storewide",
      ticker_text: "🚚 Free express courier shipping with code EXPRESSFREE",
    },
  },
  {
    id: "brakes15",
    emoji: "🔥",
    label: "Brakes 15% Clearance",
    durationDays: 5,
    categoryMatch: /brake/i,
    sale: {
      name: "Brakes Clearance",
      code: "BRAKES15",
      discount_type: "percent",
      discount_value: 15,
      scope: "categories",
      ticker_text: "🔥 BRAKES CLEARANCE: 15% off all brakes with code BRAKES15",
    },
  },
];

// Real viewport sizes, the simulator renders at these and scales to fit.
export const SIMULATOR_DEVICES: (SegmentedOption<SimulatorDevice> & { width: number; height: number })[] = [
  { value: "desktop", label: "Desktop", icon: Monitor, width: 1280, height: 800 },
  { value: "tablet", label: "Tablet", icon: Tablet, width: 768, height: 1024 },
  { value: "mobile", label: "Mobile", icon: Smartphone, width: 390, height: 844 },
];
