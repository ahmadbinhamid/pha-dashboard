// middlewares/validate.js

const Joi = require("joi");
const { badRequest } = require("../utils/http/response");

// Usage: validate({ body: Joi.object(...), params: Joi.object(...), query: Joi.object(...) })
module.exports = (schemas = {}, options = {}) => {
  const compiled = {
    body: schemas.body || null,
    params: schemas.params || null,
    query: schemas.query || null,
  };

  return (req, res, next) => {
    try {
      const toValidate = {};
      if (compiled.body) toValidate.body = req.body ?? {};
      if (compiled.params) toValidate.params = req.params ?? {};
      if (compiled.query) toValidate.query = req.query ?? {};

      const wrapper = Joi.object({
        body: compiled.body || Joi.any(),
        params: compiled.params || Joi.any(),
        query: compiled.query || Joi.any(),
      });

      const { value, error } = wrapper.validate(toValidate, {
        abortEarly: false,
        stripUnknown: true,
        ...options,
      });

      if (error) {
        return badRequest(res, error.details.map((d) => d.message).join("; "));
      }

      if (value.body) req.body = value.body;
      if (value.params) req.params = value.params;
      if (value.query) {
        // Express 5's req.query is a getter-only accessor, so a plain assignment silently
        // no-ops and Joi's coercion (e.g. year: Joi.number()) never took effect. Redefine the
        // property to replace the getter with a real data property.
        Object.defineProperty(req, "query", {
          value: value.query,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
};
