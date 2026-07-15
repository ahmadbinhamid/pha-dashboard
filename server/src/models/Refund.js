// models/Refund.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { REFUND_REASON, REFUND_STATUS } = require("../constants/refund.constants");

const refundSchema = buildSchema({
  payment: { type: Schema.Types.ObjectId, ref: "Payment", required: true },
  order: { type: Schema.Types.ObjectId, ref: "Order", required: true },

  stripe_refund_id: { type: String, default: null }, // null until Stripe confirms creation
  amount: { type: Number, required: true }, // cents

  reason: {
    type: String,
    enum: Object.values(REFUND_REASON),
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(REFUND_STATUS),
    default: REFUND_STATUS.PENDING,
  },
  failure_reason: { type: String, default: null },

  // How this Refund doc came to exist:
  //  - "admin_api": created by our own POST /payments/:id/refund endpoint
  //  - "stripe_dashboard": reconciled from a charge.refunded webhook whose
  //    stripe_refund_id we didn't already know — i.e. issued directly from
  //    the Stripe dashboard, bypassing our API entirely
  initiated_via: {
    type: String,
    enum: ["admin_api", "stripe_dashboard"],
    default: "admin_api",
  },
  // Admin user who triggered the refund — null for "stripe_dashboard" refunds,
  // since no admin in our system initiated those.
  initiated_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
});

refundSchema.index({ payment: 1 });

module.exports = model("Refund", refundSchema);
