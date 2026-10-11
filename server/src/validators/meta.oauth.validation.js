// validators/meta.oauth.validation.js
// POST /meta/oauth/complete: the catalog picked after consent.

const Joi = require("joi");

const completeConnect = {
  body: Joi.object({
    catalogId: Joi.string().trim().pattern(/^\d+$/).required(),
  }),
};

module.exports = { completeConnect };
