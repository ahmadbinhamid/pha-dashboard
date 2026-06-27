const Joi = require("joi");

const submit = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    email: Joi.string().trim().lowercase().email().required(),
    phone: Joi.string().trim().max(30).allow("", null).optional(),
    subject: Joi.string()
      .valid(
        "General Inquiry",
        "Parts Request",
        "Trade Account",
        "Warranty & Returns",
        "Bulk / Wholesale Order",
        "Other"
      )
      .required(),
    message: Joi.string().trim().min(1).max(2000).required(),
  }),
};

module.exports = { submit };
