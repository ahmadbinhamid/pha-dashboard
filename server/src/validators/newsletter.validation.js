// validators/newsletter.validation.js

const Joi = require("joi");
const { SIGNUP_SOURCE } = require("../constants/storefront.constants");

const subscribe = {
  body: Joi.object({
    email: Joi.string().trim().lowercase().email().required(),
    first_name: Joi.string().trim().allow("").max(80),
    source: Joi.string().valid(...Object.values(SIGNUP_SOURCE)).default(SIGNUP_SOURCE.FOOTER),
  }),
};

module.exports = { subscribe };
