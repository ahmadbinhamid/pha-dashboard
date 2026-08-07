// validators/pendingReconciliation.validation.js

const Joi = require("joi");

const resolveReconciliation = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
  }),
};

module.exports = { resolveReconciliation };
