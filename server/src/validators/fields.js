// validators/fields.js
// Shared Joi field builders; multipart helpers check strings, never coerce.

const Joi = require("joi");

const objectId = Joi.string().hex().length(24);

/** Optional text that may be blank or null, capped at `max` characters. */
const optionalText = (max) => Joi.string().max(max).allow("", null);

// Multipart sends strings; native JSON callers may send real types.
const formBool = Joi.alternatives(Joi.boolean().strict(), Joi.string().valid("true", "false"));

const isNonNegativeNumber = (value) => value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;

/** A number >= 0, or its string form; "" stays allowed for cleared fields. */
const formNumber = Joi.alternatives(
  Joi.number().strict().min(0),
  Joi.string().allow("").max(32).custom((value, helpers) =>
    value === "" || isNonNegativeNumber(value) ? value : helpers.error("number.base"),
  ),
).allow(null);

/** A value from `values`, or "" (callers fall back to their default). */
const formEnum = (values) => Joi.string().valid(...values, "");

/** A JSON string the controller parses (or the parsed value itself). */
const formJson = (shape, max = 100_000) =>
  Joi.alternatives(
    shape,
    Joi.string().allow("").max(max).custom((value, helpers) => {
      if (value === "") return value;
      try {
        const { error } = shape.validate(JSON.parse(value));
        return error ? helpers.error("any.invalid") : value;
      } catch {
        return helpers.error("any.invalid");
      }
    }),
  ).allow(null);

module.exports = { objectId, optionalText, formBool, formNumber, formEnum, formJson };
