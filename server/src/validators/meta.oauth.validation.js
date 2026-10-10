// validators/meta.oauth.validation.js
// POST /meta/oauth/complete: the business and catalog picked after consent.

const Joi = require("joi");

const completeConnect = {
  body: Joi.object({
    businessId: Joi.string().trim().pattern(/^\d+$/).required(),
    catalogId: Joi.string().trim().pattern(/^\d+$/).required(),
  }),
};

module.exports = { completeConnect };
