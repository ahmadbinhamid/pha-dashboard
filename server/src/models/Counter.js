// models/Counter.js
//
// Generic atomic sequence generator. Order numbers are assigned via
// findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, new: true })
// which Mongo guarantees is atomic even under concurrent checkouts.

const { model, Schema } = require("mongoose");

const counterSchema = new Schema(
  {
    _id: { type: String, required: true }, // e.g. "order_number"
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

module.exports = model("Counter", counterSchema);
