// models/Feedback.js
// A customer's rating (and optional comment) for one product they bought.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { RATING } = require("../constants/followup.constants");

const feedbackSchema = buildSchema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    follow_up_send_id: { type: Schema.Types.ObjectId, ref: "FollowUpSend", required: true },
    order_id: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    // Order line id: custom lines have no product, but still get rated.
    item_id: { type: Schema.Types.ObjectId, required: true },
    product_id: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    product_name: { type: String, required: true },
    customer_name: { type: String, default: "" },
    customer_email: { type: String, required: true, lowercase: true },
    rating: { type: Number, min: RATING.MIN, max: RATING.MAX, required: true },
    comment: { type: String, default: "", trim: true },
    alerted_at: { type: Date, default: null },
  },
  { softDelete: false },
);

// One rating per bought line; changing your mind updates it.
feedbackSchema.index({ follow_up_send_id: 1, item_id: 1 }, { unique: true });
feedbackSchema.index({ tenant_id: 1, created_at: -1 });
feedbackSchema.index({ tenant_id: 1, rating: 1 });
feedbackSchema.index({ tenant_id: 1, product_id: 1 });

module.exports = model("Feedback", feedbackSchema);
