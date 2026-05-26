// models/Category.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");

const categorySchema = buildSchema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true },
  parent: {
    type: Schema.Types.ObjectId,
    ref: "Category",
    default: null,
  },
  sort_order: { type: Number, default: 0 },
});

module.exports = model("Category", categorySchema);
