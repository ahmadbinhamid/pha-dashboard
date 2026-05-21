// validators/user.validation.js

const Joi = require("joi");

const listUsers = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    status: Joi.string().valid("0", "1", "2").optional(),
  }),
};

const byIdParam = {
  params: Joi.object({
    id: Joi.string()
      .pattern(/^[a-f\d]{24}$/i)
      .required()
      .messages({ "string.pattern.base": "Invalid id format" }),
  }),
};

const updateUser = {
  body: Joi.object({
    first_name: Joi.string().trim().min(1).max(50).required(),
    last_name: Joi.string().trim().min(1).max(50).required(),
  }),
};

module.exports = { listUsers, byIdParam, updateUser };
