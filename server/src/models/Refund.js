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
  //  - "admin_api": created by our own POST /payment/:id/refund endpoint (Stripe)
  //  - "stripe_dashboard": reconciled from a charge.refunded webhook whose
  //    stripe_refund_id we didn't already know — i.e. issued directly from
  //    the Stripe dashboard, bypassing our API entirely
  //  - "manual": staff recorded a refund for a non-Stripe (cash/online
  //    transfer/EFPOS) payment via POST /payment/:id/refund-manual — no
  //    gateway call, the amount is just handed back outside the system
  initiated_via: {
    type: String,
    enum: ["admin_api", "stripe_dashboard", "manual"],
    default: "admin_api",
  },
  // Admin user who triggered the refund — null for "stripe_dashboard" refunds,
  // since no admin in our system initiated those.
  initiated_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
});

refundSchema.index({ payment: 1 }, { name: "payment_1" });

// Backstops the read-then-act pending check in stripe.refund.service.js
// (createRefund) against a genuine concurrent double-submit race — at most
// one "pending" Refund per payment can exist at the database level.
refundSchema.index(
  { payment: 1 },
  {
    name: "payment_1_pending_unique",
    unique: true,
    partialFilterExpression: { status: REFUND_STATUS.PENDING },
  },
);

module.exports = model("Refund", refundSchema);
