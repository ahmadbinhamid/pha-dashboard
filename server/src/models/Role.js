// models/Role.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { ALL_PERMISSIONS } = require("../config/permissions");

/** A named set of permissions inside one tenant, held through a Membership. Permissions are
 * stored as `group.action` strings from config/permissions.js, the source of truth, not references. */
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

// One role name per tenant; partial on deleted_at so a deleted role's name frees up again.
roleSchema.index(
  { tenant_id: 1, name: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null } },
);

module.exports = model("Role", roleSchema);
