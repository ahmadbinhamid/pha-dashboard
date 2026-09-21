// models/Invitation.js

const { model, Schema } = require("mongoose");
const { buildSchema, stripInternalFields } = require("./base.model");
const { INVITE_STATUS } = require("../constants/access.constants");

/**
 * One invite per email per organisation. The row is REUSED: inviting an
 * address that was already invited, declined or revoked reopens the same row
 * with a fresh link, so the members screen shows one line per person rather
 * than a history of attempts. (Same rule as flowpos-backend's
 * tenant_user_invites — "one email, one tenant, one link".)
 *
 * Only the SHA-256 of the link's token is stored. A stolen database dump
 * therefore can't be used to join anyone's organisation, which is also why
 * "copy link" is only offered in the response to sending or resending —
 * there is nothing to recover it from afterwards. (flowpos-backend also keeps
 * an encrypted copy so the link can be re-shown; we deliberately don't.)
 */
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
  // Cleared the moment the invite stops being redeemable, so a link works at
  // most once.
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

/**
 * Expiry is not a status: a pending invite past `expires_at` reports itself
 * expired, its link is dead, and re-sending revives the same row.
 */
invitationSchema.virtual("is_expired").get(function isExpired() {
  return Boolean(this.expires_at && this.expires_at.getTime() < Date.now());
});

invitationSchema.set("toJSON", { virtuals: true, transform: stripInternalFields });
invitationSchema.set("toObject", { virtuals: true, transform: stripInternalFields });

module.exports = model("Invitation", invitationSchema);
