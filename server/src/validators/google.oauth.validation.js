// validators/google.oauth.validation.js
// Validates POST /google/oauth/complete's body. feedLabel/contentLanguage are optional since
// completeConnect defaults them server-side; only merchantId and targetCountry are required.

const Joi = require("joi");

const completeConnect = {
  body: Joi.object({
    merchantId: Joi.string().trim().min(1).required(),
    targetCountry: Joi.string().trim().min(1).required(),
    feedLabel: Joi.string().trim().allow(null, ""),
    contentLanguage: Joi.string().trim().allow(null, ""),
  }),
};

module.exports = { completeConnect };
