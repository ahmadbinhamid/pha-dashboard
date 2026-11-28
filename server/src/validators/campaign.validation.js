// validators/campaign.validation.js

const Joi = require("joi");
const {
  CAMPAIGN_KIND,
  CAMPAIGN_STATUS,
  AUDIENCE_TYPE,
  RECURRENCE_FREQUENCY,
  MAX_MONTHLY_DAY,
  LIST_NAME_MAX,
  MAX_SELECTED_CONTACTS,
} = require("../constants/campaign.constants");
const { design } = require("./campaign-design.validation");
const { isValidTimezone } = require("../utils/campaignSchedule");

const objectId = Joi.string().hex().length(24);
const listName = Joi.string().trim().min(1).max(LIST_NAME_MAX);

const audience = Joi.object({
  type: Joi.string().valid(...Object.values(AUDIENCE_TYPE)).required(),
  lists: Joi.array().items(listName).max(50).default([]),
  contact_ids: Joi.array().items(objectId).max(MAX_SELECTED_CONTACTS).default([]),
});

const timezone = Joi.string().custom((value, helpers) => (isValidTimezone(value) ? value : helpers.error("any.invalid")));

const recurrence = Joi.object({
  frequency: Joi.string().valid(...Object.values(RECURRENCE_FREQUENCY)),
  day_of_week: Joi.number().integer().min(0).max(6),
  day_of_month: Joi.number().integer().min(1).max(MAX_MONTHLY_DAY),
  time: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).messages({ "string.pattern.base": "Time must be HH:mm" }),
  timezone,
});

// Shape only; sendability (subject, content, lists) is checked on send.
const campaignFields = {
  name: Joi.string().trim().min(1).max(120),
  kind: Joi.string().valid(...Object.values(CAMPAIGN_KIND)),
  subject: Joi.string().trim().allow("").max(200),
  preheader: Joi.string().trim().allow("").max(200),
  body_html: Joi.string().allow("").max(500000),
  design: design.allow(null),
  audience,
  recurrence,
};

const byIdParam = { params: Joi.object({ id: objectId.required() }) };

const listCampaigns = {
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    search: Joi.string().trim().allow("").max(100),
    status: Joi.string().valid(...Object.values(CAMPAIGN_STATUS)),
    kind: Joi.string().valid(...Object.values(CAMPAIGN_KIND)),
  }),
};

const createCampaign = { body: Joi.object({ ...campaignFields, name: campaignFields.name.required() }) };

const updateCampaign = { ...byIdParam, body: Joi.object(campaignFields).min(1) };

const scheduleCampaign = { ...byIdParam, body: Joi.object({ scheduled_at: Joi.date().iso() }) };

const testCampaign = { ...byIdParam, body: Joi.object({ email: Joi.string().trim().lowercase().email().required() }) };

// POST: a hand-picked audience can hold up to 500 ids, too long for a URL.
const audienceCount = { body: audience };

const previewCampaign = {
  body: Joi.object({
    design: design.required(),
    subject: Joi.string().trim().allow("").max(200).default(""),
    preheader: Joi.string().trim().allow("").max(200).default(""),
  }),
};

const templateName = Joi.string().trim().min(1).max(80);
const createTemplate = { body: Joi.object({ name: templateName.required(), design: design.required() }) };
const updateTemplate = { ...byIdParam, body: Joi.object({ name: templateName, design }).min(1) };

const unsubscribe = { params: Joi.object({ token: Joi.string().hex().length(48).required() }) };

module.exports = {
  byIdParam,
  listCampaigns,
  createCampaign,
  updateCampaign,
  scheduleCampaign,
  testCampaign,
  audienceCount,
  previewCampaign,
  createTemplate,
  updateTemplate,
  unsubscribe,
};
