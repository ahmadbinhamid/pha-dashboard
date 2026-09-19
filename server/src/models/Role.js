// models/Role.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { ALL_PERMISSIONS } = require("../config/permissions");

/**
 * A named set of permissions inside one tenant. Users are never granted
 * permissions directly — they hold a Role through a Membership, which is what
 * makes "change what this person can do" a single field update.
 *
 * Permissions are stored as the `group.action` strings from
 * config/permissions.js rather than as references into a permissions
 * collection: that file is the source of truth, so a join collection would
 * only be a second copy of it to keep in step. (flowpos-backend uses
 * tenant_permission/tenant_role_permission tables because it's SQL and can
 * join them; nothing here needs that.)
 */
const roleSchema = buildSchema({
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: null, trim: true },
  permissions: {
    type: [{ type: String, enum: ALL_PERMISSIONS }],
    default: [],
  },
  // Seeded with the tenant; can't be edited or deleted. See SYSTEM_ROLE.
  is_system: { type: Boolean, default: false },
});

// One role name per tenant. Partial on deleted_at so a deleted role's name
// frees up again, matching how User's email index is scoped.
roleSchema.index(
  { tenant_id: 1, name: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null } },
);

module.exports = model("Role", roleSchema);
