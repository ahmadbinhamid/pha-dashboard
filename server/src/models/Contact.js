// models/Contact.js
// A marketing email recipient: newsletter signup, import or opted-in customer.

const crypto = require("crypto");
const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { CONTACT_STATUS, CONTACT_SOURCE } = require("../constants/campaign.constants");

const newUnsubscribeToken = () => crypto.randomBytes(24).toString("hex");

// NOTE: hard delete, so a re-added address is a fresh record with no history.
const contactSchema = buildSchema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    first_name: { type: String, default: null, trim: true },
    last_name: { type: String, default: null, trim: true },
    status: { type: String, enum: Object.values(CONTACT_STATUS), default: CONTACT_STATUS.SUBSCRIBED },
    source: { type: String, enum: Object.values(CONTACT_SOURCE), required: true },
    lists: { type: [String], default: [] },
    customer_id: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    unsubscribe_token: { type: String, default: newUnsubscribeToken },
    subscribed_at: { type: Date, default: Date.now },
    unsubscribed_at: { type: Date, default: null },
    // The receiving server's words, so staff can see why it stopped.
    bounce_reason: { type: String, default: null },
    bounced_at: { type: Date, default: null },
    last_emailed_at: { type: Date, default: null },
  },
  { softDelete: false },
);

contactSchema.index({ tenant_id: 1, email: 1 }, { unique: true });
contactSchema.index({ unsubscribe_token: 1 }, { unique: true });
// Fan-out walks subscribed contacts in _id order, optionally by list.
contactSchema.index({ tenant_id: 1, status: 1, _id: 1 });
contactSchema.index({ tenant_id: 1, lists: 1, status: 1 });

contactSchema.statics.newUnsubscribeToken = newUnsubscribeToken;

module.exports = model("Contact", contactSchema);
