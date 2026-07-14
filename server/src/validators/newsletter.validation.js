const Joi = require("joi");

const subscribe = {
  body: Joi.object({
    email: Joi.string().trim().lowercase().email().required(),
  }),
};

module.exports = { subscribe };
