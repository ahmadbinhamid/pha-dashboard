// models/Membership.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { MEMBERSHIP_STATUS } = require("../constants/access.constants");

/**
 * One person's place in one organisation — the join between User and Tenant,
 * carrying the role they hold there.
 *
 * This is what makes a user able to belong to several organisations at once
 * (the model flowpos-backend uses via its `tenant_user` pivot): the User doc
 * holds identity only, and everything tenant-scoped — role, status, when they
 * joined — lives here. Removing someone from an organisation deletes their
 * membership, never their account or their place in other organisations.
 */
const membershipSchema = buildSchema({
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  role_id: { type: Schema.Types.ObjectId, ref: "Role", required: true },
  // Which organisation the dashboard opens on when no other is requested.
  // Exactly one per user — see membership.service.js#setDefaultMembership.
  is_default: { type: Boolean, default: false },
  // Suspended keeps the history (who did what) while removing every
  // permission — hasPermission only ever considers an active membership.
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
