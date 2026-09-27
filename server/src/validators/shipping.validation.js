// validators/shipping.validation.js

const Joi = require("joi");
const { ADDRESS_TYPE } = require("../constants/shipping.constants");

const objectId = Joi.string().hex().length(24);
const postcode = Joi.string().trim().pattern(/^\d{4}$/).messages({ "string.pattern.base": "Postcode must be 4 digits" });

const quote = {
  body: Joi.object({
    items: Joi.array()
      .items(Joi.object({ product: objectId.required(), variant: objectId.allow(null), quantity: Joi.number().integer().min(1).required() }))
      .min(1)
      .max(100)
      .required(),
    receiver: Joi.object({
      postcode: postcode.required(),
      suburb: Joi.string().trim().min(1).max(80).required(),
      state: Joi.string().trim().max(10).allow("", null),
    }).required(),
  }),
};

const updateSettings = {
  body: Joi.object({
    // Blank keeps the saved key.
    api_key: Joi.string().trim().max(200).allow(""),
    sender_postcode: postcode.allow("", null),
    sender_suburb: Joi.string().trim().max(80).allow("", null),
    sender_state: Joi.string().trim().max(10).allow("", null),
    sender_type: Joi.string().valid(...Object.values(ADDRESS_TYPE)),
  }).min(1),
};

module.exports = { quote, updateSettings };
