// models/Business.js
// A trading account that one or more customers represent.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { PAYMENT_TERMS_DAYS } = require("../constants/business.constants");

// Case-insensitive, so "ABC Motors" and "abc motors" resolve to one business.
const NAME_COLLATION = Object.freeze({ locale: "en", strength: 2 });

const businessSchema = buildSchema({
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  name: { type: String, required: true, trim: true },
  payment_terms_days: { type: Number, enum: [...PAYMENT_TERMS_DAYS, null], default: null },
});

businessSchema.index(
  { tenant_id: 1, name: 1 },
  { unique: true, collation: NAME_COLLATION, partialFilterExpression: { deleted_at: null } },
);

const Business = model("Business", businessSchema);

module.exports = Business;
module.exports.NAME_COLLATION = NAME_COLLATION;
