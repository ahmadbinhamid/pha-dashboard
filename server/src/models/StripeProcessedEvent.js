// models/StripeProcessedEvent.js
// Idempotency ledger for incoming Stripe webhooks, mirroring EbayProcessedOrder's atomic
// create() + catch duplicate-key pattern instead of a read-then-write check.

const { model, Schema } = require("mongoose");

const schema = new Schema(
  {
    stripe_event_id: { type: String, required: true },
    type: { type: String, required: true }, // e.g. "payment_intent.succeeded"
    // Which tenant's webhook endpoint this was delivered to; not required for idempotency, kept for debugging.
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", default: null },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: false, versionKey: false },
);

schema.index({ stripe_event_id: 1 }, { unique: true });

module.exports = model("StripeProcessedEvent", schema);
