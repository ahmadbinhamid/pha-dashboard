// validators/tag.validation.js

const Joi = require("joi");
const {
  TAG_FONT,
  TAG_QR_POSITION,
  TAG_ALIGN,
  TAG_LINE_SPACING,
  TAG_PRINT_SOURCE,
  TAG_QUEUE_MODE,
  TAG_SIZES,
  TAG_FIELD,
  TAG_FONT_PT,
  TAG_MARGIN_MM,
  MAX_TAG_COPIES,
} = require("../constants/tag.constants");

const objectId = Joi.string().hex().length(24);
const copies = Joi.number().integer().min(1).max(MAX_TAG_COPIES);

const idParams = { params: Joi.object({ id: objectId.required() }) };

// Copies omitted: whole stock ("set") or one more tag ("increment").
const addToQueue = {
  body: Joi.object({
    product_id: objectId.required(),
    copies,
    mode: Joi.string().valid(...Object.values(TAG_QUEUE_MODE)).default(TAG_QUEUE_MODE.SET),
  }),
};

const updateQueueItem = { ...idParams, body: Joi.object({ copies: copies.required() }) };

const recordPrint = {
  body: Joi.object({
    source: Joi.string().valid(...Object.values(TAG_PRINT_SOURCE)).required(),
    items: Joi.array()
      .items(Joi.object({ product_id: objectId.required(), copies: copies.required() }))
      .min(1)
      .max(1000)
      .required(),
  }),
};

const tagField = Joi.object({
  key: Joi.string().valid(...Object.values(TAG_FIELD)).required(),
  visible: Joi.boolean().required(),
  size_pt: Joi.number().min(TAG_FONT_PT.min).max(TAG_FONT_PT.max).required(),
  bold: Joi.boolean().required(),
});

const updateStyle = {
  body: Joi.object({
    size: Joi.string().valid(...TAG_SIZES),
    font: Joi.string().valid(...Object.values(TAG_FONT)),
    qr_position: Joi.string().valid(...Object.values(TAG_QR_POSITION)),
    align: Joi.string().valid(...Object.values(TAG_ALIGN)),
    line_spacing: Joi.string().valid(...Object.values(TAG_LINE_SPACING)),
    margin_mm: Joi.number().min(TAG_MARGIN_MM.min).max(TAG_MARGIN_MM.max),
    fields: Joi.array().items(tagField).unique("key").max(Object.keys(TAG_FIELD).length),
  }).min(1),
};

module.exports = { idParams, addToQueue, updateQueueItem, recordPrint, updateStyle };
