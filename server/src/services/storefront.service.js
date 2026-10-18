// services/storefront.service.js
// Storefront content: hero slides, announcement strip and the featured sale.

const { omit } = require("lodash");
const StorefrontSettings = require("../models/StorefrontSettings");
const { getDiscountSummary, upsertDiscountByCode } = require("./discount.service");
const { httpError } = require("../utils/http/httpError");
const { DISCOUNT_STATUS } = require("../constants/discount.constants");

const ANNOUNCEMENT_FIELDS = [
  "enabled",
  "message",
  "link_url",
  "link_label",
  "theme",
  "bg_color",
  "text_color",
  "icon",
  "dismissible",
  "placement",
  "starts_at",
  "ends_at",
];
const HERO_SETTINGS_FIELDS = ["autoplay", "interval_seconds", "show_arrows", "show_dots", "height"];
const PROMOTION_DISPLAY_FIELDS = [
  "ticker_speed",
  "ticker_theme",
  "ticker_bg_color",
  "ticker_text_color",
  "show_countdown",
  "show_hero_card",
  "show_product_badges",
];
const FLASH_SALE_FIELDS = ["active", "discount_id", "ticker_text", ...PROMOTION_DISPLAY_FIELDS];

// What the storefront may see of a featured discount.
const PUBLIC_SALE_FIELDS = [
  "name",
  "code",
  "is_automatic",
  "discount_type",
  "discount_value",
  "minimum_order",
  "scope",
  "eligible_category_ids",
  "ends_at",
  "min_order_number",
  "max_order_number",
];

// Schema defaults, built once, unsaved tenants read as switched off.
const BLANK = new StorefrontSettings().toObject();
// Slides saved before newer fields existed still read with their defaults.
const SLIDE_DEFAULTS = omit(new StorefrontSettings({ hero_slides: [{ title: "-", image_url: "-" }] }).toObject().hero_slides[0], [
  "_id",
  "title",
  "image_url",
]);

function withDefaults(doc) {
  return {
    hero_slides: (doc?.hero_slides ?? []).map((s) => ({ ...SLIDE_DEFAULTS, ...s })),
    hero_settings: { ...BLANK.hero_settings, ...doc?.hero_settings },
    announcement: { ...BLANK.announcement, ...doc?.announcement },
    flash_sale: { ...BLANK.flash_sale, ...doc?.flash_sale },
    updated_at: doc?.updated_at ?? null,
  };
}

/** Dot-path $set for the fields of one embedded section present in patch. */
function sectionSet(section, fields, patch) {
  return Object.fromEntries(fields.filter((f) => patch[f] !== undefined).map((f) => [`${section}.${f}`, patch[f]]));
}

async function findSettings(tenantId) {
  return withDefaults(await StorefrontSettings.findOne({ tenant_id: tenantId }).lean());
}

// Admin view: the featured discount's details ride along for the preview.
async function withFeaturedDiscount(tenantId, settings) {
  return { ...settings, featured_discount: await getDiscountSummary(settings.flash_sale.discount_id, tenantId) };
}

async function upsertSettings(tenantId, update) {
  const doc = await StorefrontSettings.findOneAndUpdate(
    { tenant_id: tenantId },
    { ...update, $setOnInsert: { tenant_id: tenantId } },
    { upsert: true, new: true, runValidators: true },
  ).lean();
  return withFeaturedDiscount(tenantId, withDefaults(doc));
}

async function getSettings(tenantId) {
  return withFeaturedDiscount(tenantId, await findSettings(tenantId));
}

/** Replaces the slide list, array order is display order. */
async function updateHeroSlides(tenantId, slides) {
  return upsertSettings(tenantId, { $set: { hero_slides: slides } });
}

async function updateHeroSettings(tenantId, patch) {
  return upsertSettings(tenantId, { $set: sectionSet("hero_settings", HERO_SETTINGS_FIELDS, patch) });
}

async function updateAnnouncement(tenantId, patch) {
  return upsertSettings(tenantId, { $set: sectionSet("announcement", ANNOUNCEMENT_FIELDS, patch) });
}

async function updateFlashSale(tenantId, patch) {
  const current = (await findSettings(tenantId)).flash_sale;
  const discountId = patch.discount_id !== undefined ? patch.discount_id : current.discount_id;
  if (patch.discount_id && !(await getDiscountSummary(patch.discount_id, tenantId))) {
    throw httpError("Discount not found", 422);
  }
  if ((patch.active ?? current.active) && !discountId) throw httpError("Pick a discount to feature first", 422);
  return upsertSettings(tenantId, { $set: sectionSet("flash_sale", FLASH_SALE_FIELDS, patch) });
}

/** Quick launch: creates/refreshes the preset's discount and features it. */
async function launchFlashSale(tenantId, { ticker_text, ...discount }) {
  const launched = await upsertDiscountByCode(tenantId, { ...discount, is_automatic: false, active: true });
  return upsertSettings(tenantId, {
    $set: { "flash_sale.active": true, "flash_sale.discount_id": launched._id, "flash_sale.ticker_text": ticker_text ?? "" },
  });
}

async function publicSale(tenantId, flashSale) {
  if (!flashSale.active) return null;
  const discount = await getDiscountSummary(flashSale.discount_id, tenantId);
  if (discount?.status !== DISCOUNT_STATUS.LIVE) return null;
  const fields = Object.fromEntries(PUBLIC_SALE_FIELDS.map((f) => [f, discount[f]]));
  const display = Object.fromEntries(PROMOTION_DISPLAY_FIELDS.map((f) => [f, flashSale[f]]));
  return { ...fields, ...display, ticker_text: flashSale.ticker_text };
}

/** Inside an optional [starts_at, ends_at) window. */
function isInWindow({ starts_at, ends_at }, now = new Date()) {
  return (!starts_at || new Date(starts_at) <= now) && (!ends_at || new Date(ends_at) > now);
}

/** What the storefront renders: live content only, nothing switched off. */
async function getPublicStorefront(tenantId) {
  const { hero_slides, hero_settings, announcement, flash_sale } = await findSettings(tenantId);
  const showBanner = announcement.enabled && announcement.message && isInWindow(announcement);
  return {
    hero_slides: hero_slides.filter((s) => s.active && isInWindow(s)),
    hero_settings,
    announcement: showBanner ? announcement : null,
    flash_sale: await publicSale(tenantId, flash_sale),
  };
}

module.exports = {
  getSettings,
  updateHeroSlides,
  updateHeroSettings,
  updateAnnouncement,
  updateFlashSale,
  launchFlashSale,
  getPublicStorefront,
};
