// models/PendingReconciliation.js
// A quantity drift confirmed on two consecutive polls but never auto-applied — that mechanism
// twice corrupted live stock historically. Surfaced for a human to accept/reject instead.

const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "MarketplaceListing", required: true },
    sku: { type: String, required: true },
    local_qty: { type: Number, required: true },
    ebay_qty: { type: Number, required: true },
    delta: { type: Number, required: true },
    first_seen_at: { type: Date, default: Date.now },
    last_seen_at: { type: Date, default: Date.now },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
    resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolved_at: { type: Date, default: null },
  },
  { timestamps: false, versionKey: false },
);

// Only one open row per listing; a second drift on a pending listing extends last_seen_at
// rather than duplicating. Once resolved, a fresh drift starts a new row via the partial filter.
schema.index(
  { tenant_id: 1, listing: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);

module.exports = mongoose.model("PendingReconciliation", schema);
