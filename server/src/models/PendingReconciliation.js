// models/PendingReconciliation.js
//
// A quantity drift the eBay inventory-sync poller confirmed on two
// consecutive polls (see ebay.inventory-sync.service.js) but did NOT apply
// automatically — auto-applying a "seller changed it on eBay" correction is
// exactly the mechanism that twice corrupted live stock (see git history:
// duplicate-listing incident, then the read-lag false-restock incident).
// Surfacing it here for a human to accept/reject, instead, trades a little
// operator friction for making automatic stock corruption structurally
// impossible from this code path.

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

// Only one open row per listing at a time — a second drift on an already
// "pending" listing just extends the existing row (last_seen_at) rather than
// spawning a duplicate. Once resolved (accepted/rejected), a fresh drift
// starts a new row, which the partial filter allows.
schema.index(
  { tenant_id: 1, listing: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);

module.exports = mongoose.model("PendingReconciliation", schema);
