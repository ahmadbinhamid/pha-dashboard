// validators/vehicle-model.validation.js

const Joi = require("joi");

const listModels = {
  query: Joi.object({
    make: Joi.string().trim().min(1).required(),
  }),
};

const listModelCodes = {
  query: Joi.object({
    make: Joi.string().trim().min(1).required(),
    model: Joi.string().trim().min(1).required(),
  }),
};

const getYears = {
  query: Joi.object({
    make: Joi.string().trim().min(1).required(),
    model: Joi.string().trim().min(1).required(),
    model_code: Joi.string().trim().allow("").required(),
  }),
};

module.exports = { listModels, listModelCodes, getYears };
