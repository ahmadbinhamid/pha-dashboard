// validators/location.validation.js

const Joi = require("joi");
const { objectId, optionalText } = require("./fields");

const byIdParam = { params: Joi.object({ id: objectId.required() }) };

const createLocation = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    address: optionalText(500),
    is_active: Joi.boolean(),
  }),
};

const updateLocation = {
  ...byIdParam,
  body: Joi.object({
    name: Joi.string().trim().min(1).max(100),
    address: optionalText(500),
    is_active: Joi.boolean(),
  }),
};

module.exports = { byIdParam, createLocation, updateLocation };
