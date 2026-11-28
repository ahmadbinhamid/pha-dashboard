// models/FollowUpSend.js
// One follow-up email for one order; the unique index stops repeats.

const crypto = require("crypto");
const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { FOLLOW_UP_SEND_STATUS } = require("../constants/followup.constants");

const newToken = () => crypto.randomBytes(24).toString("hex");

const followUpSendSchema = buildSchema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    follow_up_id: { type: Schema.Types.ObjectId, ref: "FollowUp", required: true },
    order_id: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    // Opens the feedback page and the opt-out page; never guessable.
    token: { type: String, default: newToken },
    status: { type: String, enum: Object.values(FOLLOW_UP_SEND_STATUS), default: FOLLOW_UP_SEND_STATUS.QUEUED },
    sent_at: { type: Date, default: null },
    error: { type: String, default: null },
  },
  { softDelete: false },
);

followUpSendSchema.index({ follow_up_id: 1, order_id: 1 }, { unique: true });
followUpSendSchema.index({ token: 1 }, { unique: true });
followUpSendSchema.index({ tenant_id: 1, follow_up_id: 1, created_at: -1 });

module.exports = model("FollowUpSend", followUpSendSchema);
