// services/membershipAudit.service.js
// Users with no active membership, and the legacy owners safe to backfill.

const { Types } = require("mongoose");
const User = require("../models/User");
const Tenant = require("../models/Tenant");
const Membership = require("../models/Membership");
const Invitation = require("../models/Invitation");
const { seedSystemRoles } = require("./role.service");
const { addMember, isAdminRole } = require("./membership.service");
const { MEMBERSHIP_STATUS, SYSTEM_ROLE, OWNER_ACCOUNT_ROLES } = require("../constants/access.constants");
const { USER_STATUS } = require("../constants/user.constants");

const pairKey = (tenantId, email) => `${tenantId}:${email}`;

// Every live user lacking a live ACTIVE membership, with all membership rows.
function usersWithoutActiveMembership(tenantId) {
  return User.aggregate([
    { $match: { deleted_at: null, ...(tenantId ? { tenant_id: new Types.ObjectId(String(tenantId)) } : {}) } },
    { $lookup: { from: "memberships", localField: "_id", foreignField: "user_id", as: "memberships" } },
    { $match: { memberships: { $not: { $elemMatch: { status: MEMBERSHIP_STATUS.ACTIVE, deleted_at: null } } } } },
    {
      $project: {
        email: 1, role: 1, status: 1, tenant_id: 1, created_at: 1, last_login_at: 1,
        memberships: { tenant_id: 1, status: 1, deleted_at: 1 },
      },
    },
  ]);
}

// One query each: invitations, tenants, and tenants with an active Admin.
async function loadEvidence(users) {
  const tenantIds = [...new Set(users.map((u) => String(u.tenant_id)))];
  const [invitations, tenants, activeMemberships] = await Promise.all([
    Invitation.find({ tenant_id: { $in: tenantIds }, email: { $in: users.map((u) => u.email) } })
      .setOptions({ withDeleted: true })
      .select("tenant_id email status")
      .lean(),
    Tenant.find({ _id: { $in: tenantIds } }).select("name slug status").lean(),
    Membership.find({ tenant_id: { $in: tenantIds }, status: MEMBERSHIP_STATUS.ACTIVE })
      .populate("role_id", "name")
      .select("tenant_id user_id role_id")
      .lean(),
  ]);
  return {
    invited: new Set(invitations.map((i) => pairKey(i.tenant_id, i.email))),
    tenantById: new Map(tenants.map((t) => [String(t._id), t])),
    tenantsWithAdmin: new Set(activeMemberships.filter((m) => isAdminRole(m.role_id)).map((m) => String(m.tenant_id))),
  };
}

// NOTE: owner = an owner account role with no invitation row in that tenant.
function classify(user, { invited, tenantById, tenantsWithAdmin }) {
  const tenant = tenantById.get(String(user.tenant_id)) ?? null;
  const wasInvited = invited.has(pairKey(user.tenant_id, user.email));
  const isOriginalOwner = OWNER_ACCOUNT_ROLES.includes(user.role) && !wasInvited && user.status !== USER_STATUS.INVITED;
  const history = user.memberships.map((m) => ({
    tenant_id: String(m.tenant_id),
    status: m.deleted_at ? `${m.status} (deleted)` : m.status,
  }));

  let backfillBlocker = null;
  if (!isOriginalOwner) backfillBlocker = "not the tenant's original owner";
  else if (history.length) backfillBlocker = "has membership history (suspended/removed)";
  else if (!tenant) backfillBlocker = "tenant no longer exists";
  else if (tenantsWithAdmin.has(String(user.tenant_id))) backfillBlocker = "tenant already has an active Admin";

  return {
    user_id: String(user._id),
    email: user.email,
    account_role: user.role,
    account_status: user.status,
    tenant_id: String(user.tenant_id),
    tenant: tenant ? `${tenant.name} (${tenant.slug})` : null,
    created_at: user.created_at ?? null,
    last_login_at: user.last_login_at ?? null,
    membership_history: history,
    was_invited: wasInvited,
    is_original_owner: isOriginalOwner,
    backfill_eligible: backfillBlocker === null,
    backfill_blocker: backfillBlocker,
  };
}

/** Read-only report of every user with no active membership. */
async function auditUsersWithoutMembership({ tenantId = null } = {}) {
  const users = await usersWithoutActiveMembership(tenantId);
  if (!users.length) return [];
  const evidence = await loadEvidence(users);
  return users.map((u) => classify(u, evidence));
}

/** Gives legacy owners with no membership history an Admin membership. */
async function backfillOwnerMemberships({ tenantId = null, confirm = false } = {}) {
  const rows = await auditUsersWithoutMembership({ tenantId });
  const eligible = rows.filter((r) => r.backfill_eligible);
  const created = [];
  if (confirm) {
    for (const row of eligible) {
      const roles = await seedSystemRoles(row.tenant_id);
      await addMember({ tenantId: row.tenant_id, userId: row.user_id, roleId: roles[SYSTEM_ROLE.ADMIN]._id });
      created.push(row.user_id);
    }
  }
  return { rows, eligible, created };
}

module.exports = { auditUsersWithoutMembership, backfillOwnerMemberships };
