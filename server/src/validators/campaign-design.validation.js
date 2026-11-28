// validators/campaign-design.validation.js
// Shape of email-builder JSON, shared by campaigns and saved templates.

const Joi = require("joi");
const config = require("../config");
const {
  DESIGN_BLOCK,
  DESIGN_LEAF_BLOCKS,
  DESIGN_FONTS,
  SOCIAL_NETWORKS,
  DESIGN_LIMITS,
} = require("../constants/campaign.constants");

const hex = Joi.string().trim().pattern(/^#[0-9a-fA-F]{6}$/).messages({ "string.pattern.base": "Use a #RRGGBB colour" });
const align = Joi.string().valid("left", "center", "right");
// Root-relative storefront paths, web links, mailto or tel.
const link = Joi.alternatives().try(
  Joi.string().trim().pattern(/^\/[^\s]*$/),
  Joi.string().trim().uri({ scheme: ["http", "https", "mailto", "tel"] }),
);
// https anywhere, or a file from our own uploads (plain http in local dev).
const imageSrc = Joi.string()
  .trim()
  .max(2000)
  .custom((v, h) => (/^https:\/\/\S+$/.test(v) || v.startsWith(`${config.uploads.url}/`) ? v : h.error("any.invalid")))
  .messages({ "any.invalid": "Use an https:// image link or upload an image" });

const common = { padding_y: Joi.number().integer().min(0).max(80), background: hex.allow("") };

const PROPS = {
  [DESIGN_BLOCK.HEADING]: Joi.object({
    ...common,
    text: Joi.string().trim().allow("").max(300),
    level: Joi.number().valid(1, 2, 3),
    align,
    color: hex.allow(""),
    font_size: Joi.number().integer().min(12).max(56),
  }),
  [DESIGN_BLOCK.TEXT]: Joi.object({
    ...common,
    html: Joi.string().allow("").max(50000),
    align,
    color: hex.allow(""),
    font_size: Joi.number().integer().min(11).max(28),
  }),
  [DESIGN_BLOCK.BUTTON]: Joi.object({
    ...common,
    label: Joi.string().trim().allow("").max(60),
    url: link.allow(""),
    align,
    bg_color: hex,
    text_color: hex,
    radius: Joi.number().integer().min(0).max(40),
    full_width: Joi.boolean(),
  }),
  [DESIGN_BLOCK.IMAGE]: Joi.object({
    ...common,
    src: imageSrc.allow(""),
    alt: Joi.string().trim().allow("").max(200),
    link_url: link.allow(""),
    width: Joi.number().integer().min(10).max(100),
    align,
    radius: Joi.number().integer().min(0).max(40),
  }),
  [DESIGN_BLOCK.LOGO]: Joi.object({ ...common, width: Joi.number().integer().min(40).max(400), align }),
  [DESIGN_BLOCK.DIVIDER]: Joi.object({ ...common, color: hex, thickness: Joi.number().integer().min(1).max(8) }),
  [DESIGN_BLOCK.SPACER]: Joi.object({ ...common, height: Joi.number().integer().min(4).max(160) }),
  [DESIGN_BLOCK.PRODUCTS]: Joi.object({
    ...common,
    columns: Joi.number().valid(1, 2, 3),
    show_price: Joi.boolean(),
    button_label: Joi.string().trim().allow("").max(40),
    accent_color: hex,
    items: Joi.array()
      .items(
        Joi.object({
          product_id: Joi.string().hex().length(24).allow(null, ""),
          title: Joi.string().trim().max(200).required(),
          price_label: Joi.string().trim().allow("").max(40),
          image: imageSrc.allow(""),
          url: link.allow(""),
        }),
      )
      .max(DESIGN_LIMITS.MAX_PRODUCTS),
  }),
  [DESIGN_BLOCK.SOCIAL]: Joi.object({
    ...common,
    align,
    color: hex.allow(""),
    links: Joi.array()
      .items(Joi.object({ network: Joi.string().valid(...SOCIAL_NETWORKS).required(), url: Joi.string().trim().allow("").uri({ scheme: ["http", "https"] }) }))
      .max(DESIGN_LIMITS.MAX_SOCIAL_LINKS),
  }),
};

const blockId = Joi.string().trim().max(40).required();

const blockOf = (types) =>
  Joi.object({
    id: blockId,
    type: Joi.string().valid(...types).required(),
    props: Joi.when("type", { switch: types.map((t) => ({ is: t, then: PROPS[t] })) }).default({}),
  });

const leafBlock = blockOf(DESIGN_LEAF_BLOCKS);

PROPS[DESIGN_BLOCK.COLUMNS] = Joi.object({
  ...common,
  gap: Joi.number().integer().min(0).max(48),
  columns: Joi.array()
    .items(Joi.object({ blocks: Joi.array().items(leafBlock).max(DESIGN_LIMITS.MAX_COLUMN_BLOCKS).default([]) }))
    .length(2),
});

const design = Joi.object({
  settings: Joi.object({
    background_color: hex,
    content_background: hex,
    content_width: Joi.number().integer().min(DESIGN_LIMITS.MIN_WIDTH).max(DESIGN_LIMITS.MAX_WIDTH),
    font_family: Joi.string().valid(...Object.keys(DESIGN_FONTS)),
    text_color: hex,
    link_color: hex,
  }).default({}),
  blocks: Joi.array().items(blockOf(Object.values(DESIGN_BLOCK))).max(DESIGN_LIMITS.MAX_BLOCKS).default([]),
});

module.exports = { design };
