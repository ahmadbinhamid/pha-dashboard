// validators/followup.validation.js

const Joi = require("joi");
const { design } = require("./campaign-design.validation");
const { FOLLOW_UP_CHANNELS, FOLLOW_UP_LIMITS, RATING, FEEDBACK_COMMENT_MAX, MAX_RATED_ITEMS } = require("../constants/followup.constants");

const objectId = Joi.string().hex().length(24);
const byIdParam = { params: Joi.object({ id: objectId.required() }) };
const token = { params: Joi.object({ token: Joi.string().hex().length(48).required() }) };
const delay = Joi.number().integer().min(FOLLOW_UP_LIMITS.MIN_DAYS).max(FOLLOW_UP_LIMITS.MAX_DAYS);

const followUpFields = {
  name: Joi.string().trim().min(1).max(120),
  shipped_delay_days: delay,
  handover_delay_days: delay,
  channels: Joi.array().items(Joi.string().valid(...FOLLOW_UP_CHANNELS)).unique(),
  subject: Joi.string().trim().allow("").max(200),
  preheader: Joi.string().trim().allow("").max(200),
  design: design.allow(null),
  ask_for_rating: Joi.boolean(),
  alert_at_or_below: Joi.number().integer().min(0).max(RATING.MAX),
  alert_email: Joi.string().trim().lowercase().email().allow(""),
};

const rating = Joi.number().integer().min(RATING.MIN).max(RATING.MAX);

module.exports = {
  byIdParam,
  createFollowUp: { body: Joi.object({ ...followUpFields, name: followUpFields.name.required() }) },
  updateFollowUp: { ...byIdParam, body: Joi.object(followUpFields).min(1) },
  setEnabled: { ...byIdParam, body: Joi.object({ enabled: Joi.boolean().required() }) },
  previewFollowUp: {
    body: Joi.object({
      design: design.required(),
      subject: Joi.string().trim().allow("").max(200).default(""),
      preheader: Joi.string().trim().allow("").max(200).default(""),
      ask_for_rating: Joi.boolean().default(true),
    }),
  },
  listFeedback: {
    query: Joi.object({
      page: Joi.number().integer().min(1),
      limit: Joi.number().integer().min(1).max(100),
      search: Joi.string().trim().allow("").max(100),
      rating,
      max_rating: rating,
    }),
  },
  token,
  submitFeedback: {
    ...token,
    body: Joi.object({
      ratings: Joi.array()
        .items(Joi.object({ item_id: objectId.required(), rating: rating.required(), comment: Joi.string().trim().allow("").max(FEEDBACK_COMMENT_MAX) }))
        .min(1)
        .max(MAX_RATED_ITEMS)
        .required(),
    }),
  },
};
