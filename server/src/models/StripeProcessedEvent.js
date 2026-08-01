// models/StripeProcessedEvent.js
//
// Idempotency ledger for incoming Stripe webhook events — mirrors the
// EbayProcessedOrder pattern (atomic create() + catch duplicate-key error
// to detect an event already handled, instead of a read-then-write check).

const { model, Schema } = require("mongoose");

const schema = new Schema(
  {
    stripe_event_id: { type: String, required: true },
    type: { type: String, required: true }, // e.g. "payment_intent.succeeded"
    // Connect account the event was delivered for — null for platform-level
    // events. Not required for idempotency (stripe_event_id is already
    // globally unique across every connected account), kept for debugging.
    stripe_account_id: { type: String, default: null },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: false, versionKey: false },
);

schema.index({ stripe_event_id: 1 }, { unique: true });

module.exports = model("StripeProcessedEvent", schema);
