// models/StorefrontSettings.js
// Per-tenant storefront content: hero slides, announcement strip, flash sale.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const c = require("../constants/storefront.constants");

const hex = (fallback) => ({ type: String, default: fallback, match: c.HEX_COLOR_PATTERN });
const promoTheme = () => ({ type: String, enum: Object.values(c.PROMO_THEME), default: c.PROMO_THEME.BRAND });

const heroSlideSchema = new Schema({
  title: { type: String, required: true, trim: true },
  subtitle: { type: String, default: "", trim: true },
  badge: { type: String, default: "", trim: true },
  cta_label: { type: String, default: "", trim: true },
  cta_url: { type: String, default: "", trim: true },
  secondary_cta_label: { type: String, default: "", trim: true },
  secondary_cta_url: { type: String, default: "", trim: true },
  image_url: { type: String, required: true, trim: true },
  // Optional portrait crop for phones, falls back to image_url.
  mobile_image_url: { type: String, default: "", trim: true },
  image_focus: { type: String, enum: Object.values(c.HERO_IMAGE_FOCUS), default: c.HERO_IMAGE_FOCUS.CENTER },
  align: { type: String, enum: Object.values(c.HERO_ALIGN), default: c.HERO_ALIGN.LEFT },
  vertical: { type: String, enum: Object.values(c.HERO_VERTICAL), default: c.HERO_VERTICAL.CENTER },
  text_tone: { type: String, enum: Object.values(c.HERO_TEXT_TONE), default: c.HERO_TEXT_TONE.LIGHT },
  overlay: { type: Number, min: c.HERO_OVERLAY.MIN, max: c.HERO_OVERLAY.MAX, default: c.HERO_OVERLAY.DEFAULT },
  // Optional window, outside it the slide is skipped even if active.
  starts_at: { type: Date, default: null },
  ends_at: { type: Date, default: null },
  active: { type: Boolean, default: true },
});

const heroSettingsSchema = new Schema(
  {
    autoplay: { type: Boolean, default: true },
    interval_seconds: {
      type: Number,
      min: c.HERO_AUTOPLAY_SECONDS.MIN,
      max: c.HERO_AUTOPLAY_SECONDS.MAX,
      default: c.HERO_AUTOPLAY_SECONDS.DEFAULT,
    },
    show_arrows: { type: Boolean, default: true },
    show_dots: { type: Boolean, default: true },
    height: { type: String, enum: Object.values(c.HERO_HEIGHT), default: c.HERO_HEIGHT.STANDARD },
  },
  { _id: false },
);

const announcementSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    message: { type: String, default: "", trim: true },
    link_url: { type: String, default: "", trim: true },
    link_label: { type: String, default: "Shop now", trim: true },
    theme: { type: String, enum: Object.values(c.ANNOUNCEMENT_THEME), default: c.ANNOUNCEMENT_THEME.INDIGO },
    bg_color: hex("#4f46e5"),
    text_color: hex("#ffffff"),
    icon: { type: String, enum: Object.values(c.ANNOUNCEMENT_ICON), default: c.ANNOUNCEMENT_ICON.SPARKLES },
    // Shoppers may close it, it stays closed for their browser session.
    dismissible: { type: Boolean, default: false },
    placement: { type: String, enum: Object.values(c.BANNER_PLACEMENT), default: c.BANNER_PLACEMENT.ALL_PAGES },
    starts_at: { type: Date, default: null },
    ends_at: { type: Date, default: null },
  },
  { _id: false },
);

// Advertises one Discount (ticker, countdown, prices), pricing lives there.
const flashSaleSchema = new Schema(
  {
    active: { type: Boolean, default: false },
    discount_id: { type: Schema.Types.ObjectId, ref: "Discount", default: null },
    ticker_text: { type: String, default: "", trim: true },
    ticker_speed: { type: String, enum: Object.values(c.TICKER_SPEED), default: c.TICKER_SPEED.NORMAL },
    ticker_theme: promoTheme(),
    ticker_bg_color: hex("#dc2626"),
    ticker_text_color: hex("#ffffff"),
    // The sale card on product pages (and its hero version's accent).
    card_theme: promoTheme(),
    card_bg_color: hex("#dc2626"),
    card_text_color: hex("#ffffff"),
    // "-20%" tags on product cards and the "Save" pill on product pages.
    badge_theme: promoTheme(),
    badge_bg_color: hex("#dc2626"),
    badge_text_color: hex("#ffffff"),
    show_countdown: { type: Boolean, default: true },
    show_hero_card: { type: Boolean, default: true },
    show_product_badges: { type: Boolean, default: true },
  },
  { _id: false },
);

const storefrontSettingsSchema = buildSchema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },
    hero_slides: { type: [heroSlideSchema], default: [] },
    hero_settings: { type: heroSettingsSchema, default: () => ({}) },
    announcement: { type: announcementSchema, default: () => ({}) },
    flash_sale: { type: flashSaleSchema, default: () => ({}) },
  },
  { softDelete: false },
);

module.exports = model("StorefrontSettings", storefrontSettingsSchema);
