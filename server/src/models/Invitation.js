// models/Invitation.js

const { model, Schema } = require("mongoose");
const { buildSchema, stripInternalFields } = require("./base.model");
const { INVITE_STATUS } = require("../constants/access.constants");

/** One invite row per email per org, reused across invite/decline/revoke; only the token's SHA-256 is stored, so a stolen dump can't join and links can't be recovered after sending. */
const invitationSchema = buildSchema({
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  role_id: { type: Schema.Types.ObjectId, ref: "Role", required: true },
  invited_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
  status: {
    type: String,
    enum: Object.values(INVITE_STATUS),
    default: INVITE_STATUS.PENDING,
    index: true,
  },
  // Cleared once the invite stops being redeemable, so a link works at most once.
  token_hash: { type: String, default: null, select: false },
  expires_at: { type: Date, default: null },
  sent_at: { type: Date, default: null },
  accepted_at: { type: Date, default: null },
  declined_at: { type: Date, default: null },
  revoked_at: { type: Date, default: null },
});

invitationSchema.index(
  { tenant_id: 1, email: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null } },
);
// Redeeming a link is a lookup by hash.
invitationSchema.index({ token_hash: 1 });

/** Expiry isn't a status field: a pending invite past expires_at reports itself expired; re-sending revives the same row. */
invitationSchema.virtual("is_expired").get(function isExpired() {
  return Boolean(this.expires_at && this.expires_at.getTime() < Date.now());
});

invitationSchema.set("toJSON", { virtuals: true, transform: stripInternalFields });
invitationSchema.set("toObject", { virtuals: true, transform: stripInternalFields });

module.exports = model("Invitation", invitationSchema);
