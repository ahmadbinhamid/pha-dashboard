// models/Location.js

const { model } = require("mongoose");
const { buildSchema } = require("./base.model");

const locationSchema = buildSchema({
  name: { type: String, required: true, trim: true },
  address: { type: String, default: null },
  is_active: { type: Boolean, default: true },
});

module.exports = model("Location", locationSchema);
