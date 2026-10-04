// validators/ebay.settings.validation.js

const Joi = require("joi");
const { optionalText } = require("./fields");

// Every field optional and blankable, as the settings form sends "" to clear.
const updateSettings = {
  body: Joi.object({
    marketplace_id: Joi.string().pattern(/^EBAY_[A-Z_]{2,20}$/).allow("", null),
    sandbox: Joi.boolean(),
    merchant_location_key: optionalText(100),
    fulfillment_policy_id: optionalText(64),
    payment_policy_id: optionalText(64),
    return_policy_id: optionalText(64),
    warehouse_street: optionalText(200),
    warehouse_city: optionalText(100),
    warehouse_state: optionalText(100),
    warehouse_postcode: optionalText(20),
    // NOTE: free-text inputs re-send stored values, so only length is capped.
    warehouse_country: optionalText(60),
    warehouse_phone: optionalText(40),
    fallback_image_url: optionalText(2000),
  }),
};

module.exports = { updateSettings };
