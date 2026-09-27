// models/TagQueueItem.js
// A product waiting in the tenant's tag print queue, with how many copies.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { MAX_TAG_COPIES } = require("../constants/tag.constants");

const tagQueueItemSchema = buildSchema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    copies: { type: Number, required: true, min: 1, max: MAX_TAG_COPIES },
    added_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { softDelete: false },
);

// One row per product; adding it again updates the copies instead.
tagQueueItemSchema.index({ tenant_id: 1, product: 1 }, { unique: true });

module.exports = model("TagQueueItem", tagQueueItemSchema);
