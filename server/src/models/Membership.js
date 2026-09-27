// models/Membership.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { MEMBERSHIP_STATUS } = require("../constants/access.constants");

/** The join between User and Tenant carrying the role held there; removing someone from an
 * organisation deletes only this membership, never their account or other memberships. */
const membershipSchema = buildSchema({
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  role_id: { type: Schema.Types.ObjectId, ref: "Role", required: true },
  // Which organisation the dashboard opens on when no other is requested; exactly one per user.
  is_default: { type: Boolean, default: false },
  // Suspended keeps the history while removing every permission; hasPermission only considers active.
  status: {
    type: String,
    enum: Object.values(MEMBERSHIP_STATUS),
    default: MEMBERSHIP_STATUS.ACTIVE,
  },
  invited_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
  joined_at: { type: Date, default: Date.now },
  last_active_at: { type: Date, default: null },
});

// A person belongs to an organisation once.
membershipSchema.index(
  { tenant_id: 1, user_id: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null } },
);
// "Which organisations am I in?" — the lookup every authenticated request makes.
membershipSchema.index({ user_id: 1, status: 1 });

module.exports = model("Membership", membershipSchema);
