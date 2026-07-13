// models/base.model.js

const { Schema } = require("mongoose");
const softDeletePlugin = require("./plugins/softDelete.plugin");

// Strip Mongoose/soft-delete internals that clients never need to see
const stripInternalFields = (doc, ret) => {
  delete ret.__v;
  delete ret.deleted_at;
  return ret;
};

// Build a schema with consistent timestamps (+ optional soft delete)
const buildSchema = (
  definition,
  {
    softDelete = true,
    timestamps = { createdAt: "created_at", updatedAt: "updated_at" },
  } = {}
) => {
  const schema = new Schema(definition, { timestamps });
  if (softDelete) schema.plugin(softDeletePlugin);
  schema.set("toJSON", { transform: stripInternalFields });
  schema.set("toObject", { transform: stripInternalFields });
  return schema;
};

module.exports = { buildSchema, stripInternalFields };
