// validators/demoRequest.validation.js

const Joi = require("joi");

const submit = {
  body: Joi.object({
    full_name: Joi.string().trim().min(1).max(100).required(),
    business_name: Joi.string().trim().min(1).max(150).required(),
    phone: Joi.string().trim().max(30).allow("", null).optional(),
    work_email: Joi.string().trim().lowercase().email().required(),
    message: Joi.string().trim().max(2000).allow("", null).optional(),
  }),
};

module.exports = { submit };
