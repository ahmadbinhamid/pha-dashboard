// constants/storefront.constants.js
// Storefront hero, announcement strip and promotion option sets.

const HERO_ALIGN = Object.freeze({ LEFT: "left", CENTER: "center", RIGHT: "right" });
const HERO_VERTICAL = Object.freeze({ TOP: "top", CENTER: "center", BOTTOM: "bottom" });
// Light text for dark photos, dark text for light ones.
const HERO_TEXT_TONE = Object.freeze({ LIGHT: "light", DARK: "dark" });
// Which part of the photo stays in frame when it's cropped (object-position).
const HERO_IMAGE_FOCUS = Object.freeze({ CENTER: "center", TOP: "top", BOTTOM: "bottom", LEFT: "left", RIGHT: "right" });
const HERO_HEIGHT = Object.freeze({ COMPACT: "compact", STANDARD: "standard", TALL: "tall" });

const HERO_OVERLAY = Object.freeze({ MIN: 0, MAX: 80, DEFAULT: 45 });
const HERO_AUTOPLAY_SECONDS = Object.freeze({ MIN: 3, MAX: 15, DEFAULT: 6 });

const MAX_HERO_SLIDES = 10;

const ANNOUNCEMENT_THEME = Object.freeze({
  INDIGO: "indigo",
  CRIMSON: "crimson",
  AMBER: "amber",
  EMERALD: "emerald",
  CARBON: "carbon",
  // Uses bg_color/text_color from the colour pickers.
  CUSTOM: "custom",
});

const ANNOUNCEMENT_ICON = Object.freeze({
  NONE: "none",
  SPARKLES: "sparkles",
  TRUCK: "truck",
  TAG: "tag",
  ZAP: "zap",
  GIFT: "gift",
});

const BANNER_PLACEMENT = Object.freeze({ ALL_PAGES: "all_pages", HOME_ONLY: "home_only" });

const TICKER_SPEED = Object.freeze({ SLOW: "slow", NORMAL: "normal", FAST: "fast" });
// Shared by the ticker, sale card and sale badge, "custom" uses picked hex.
const PROMO_THEME = Object.freeze({ BRAND: "brand", CRIMSON: "crimson", CARBON: "carbon", CUSTOM: "custom" });

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

module.exports = {
  HERO_ALIGN,
  HERO_VERTICAL,
  HERO_TEXT_TONE,
  HERO_IMAGE_FOCUS,
  HERO_HEIGHT,
  HERO_OVERLAY,
  HERO_AUTOPLAY_SECONDS,
  MAX_HERO_SLIDES,
  ANNOUNCEMENT_THEME,
  ANNOUNCEMENT_ICON,
  BANNER_PLACEMENT,
  TICKER_SPEED,
  PROMO_THEME,
  HEX_COLOR_PATTERN,
};
