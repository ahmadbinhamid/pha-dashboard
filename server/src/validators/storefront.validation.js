// validators/storefront.validation.js

const Joi = require("joi");
const config = require("../config");
const c = require("../constants/storefront.constants");
const { discountFields, promoCode } = require("./discount.validation");

const objectId = Joi.string().hex().length(24);
// Relative storefront paths ("/category/brakes") or absolute http(s) links.
const link = Joi.alternatives().try(Joi.string().trim().pattern(/^\/[^\s]*$/), Joi.string().trim().uri({ scheme: ["http", "https"] }));
// https anywhere, or a file from our own uploads (plain http in local dev).
const heroImage = Joi.string()
  .trim()
  .custom((value, helpers) =>
    /^https:\/\/\S+$/.test(value) || value.startsWith(`${config.uploads.url}/`) ? value : helpers.error("any.invalid"),
  )
  .messages({ "any.invalid": "Use an https:// image link or upload a photo" });
const hexColor = Joi.string().trim().pattern(c.HEX_COLOR_PATTERN).messages({ "string.pattern.base": "Use a #RRGGBB colour" });
const oneOf = (set) => Joi.string().valid(...Object.values(set));
const optionalDate = Joi.date().iso().allow(null);

const heroSlide = Joi.object({
  _id: objectId,
  title: Joi.string().trim().min(1).max(120).required(),
  subtitle: Joi.string().trim().max(240).allow(""),
  badge: Joi.string().trim().max(32).allow(""),
  cta_label: Joi.string().trim().max(40).allow(""),
  cta_url: link.allow(""),
  secondary_cta_label: Joi.string().trim().max(40).allow(""),
  secondary_cta_url: link.allow(""),
  image_url: heroImage.required(),
  mobile_image_url: heroImage.allow(""),
  image_focus: oneOf(c.HERO_IMAGE_FOCUS),
  align: oneOf(c.HERO_ALIGN),
  vertical: oneOf(c.HERO_VERTICAL),
  text_tone: oneOf(c.HERO_TEXT_TONE),
  overlay: Joi.number().integer().min(c.HERO_OVERLAY.MIN).max(c.HERO_OVERLAY.MAX),
  starts_at: optionalDate,
  ends_at: optionalDate.greater(Joi.ref("starts_at")).messages({ "date.greater": "End must be after start" }),
  active: Joi.boolean(),
});

const updateHeroSlides = {
  body: Joi.object({ slides: Joi.array().items(heroSlide).max(c.MAX_HERO_SLIDES).required() }),
};

const updateHeroSettings = {
  body: Joi.object({
    autoplay: Joi.boolean(),
    interval_seconds: Joi.number().integer().min(c.HERO_AUTOPLAY_SECONDS.MIN).max(c.HERO_AUTOPLAY_SECONDS.MAX),
    show_arrows: Joi.boolean(),
    show_dots: Joi.boolean(),
    height: oneOf(c.HERO_HEIGHT),
  }).min(1),
};

const updateAnnouncement = {
  body: Joi.object({
    enabled: Joi.boolean(),
    message: Joi.string().trim().max(200).allow(""),
    link_url: link.allow(""),
    link_label: Joi.string().trim().max(30).allow(""),
    theme: oneOf(c.ANNOUNCEMENT_THEME),
    bg_color: hexColor,
    text_color: hexColor,
    icon: oneOf(c.ANNOUNCEMENT_ICON),
    dismissible: Joi.boolean(),
    placement: oneOf(c.BANNER_PLACEMENT),
    starts_at: optionalDate,
    ends_at: optionalDate,
  }).min(1),
};

const updateFlashSale = {
  body: Joi.object({
    active: Joi.boolean(),
    discount_id: objectId.allow(null),
    ticker_text: Joi.string().trim().max(160).allow(""),
    ticker_speed: oneOf(c.TICKER_SPEED),
    ticker_theme: oneOf(c.TICKER_THEME),
    ticker_bg_color: hexColor,
    ticker_text_color: hexColor,
    show_countdown: Joi.boolean(),
    show_hero_card: Joi.boolean(),
    show_product_badges: Joi.boolean(),
  }).min(1),
};

// A preset's discount fields plus the ticker line to feature it with.
const launchFlashSale = {
  body: Joi.object({
    ...discountFields,
    name: discountFields.name.required(),
    code: promoCode.required(),
    discount_type: discountFields.discount_type.required(),
    ticker_text: Joi.string().trim().max(160).allow(""),
  }),
};

module.exports = { updateHeroSlides, updateHeroSettings, updateAnnouncement, updateFlashSale, launchFlashSale };
