// Team surface constants, mirroring the server's role names.

import type { InvitationStatus, MembershipStatus } from "@/types/access";
import type { AuthUser } from "@/types/auth";

// The tenant owner role; "Super Admin" until migrateTenantAdminRoles runs.
export const TENANT_ADMIN_ROLE_NAMES = ["Admin", "Super Admin"];

// NOTE: role-based permissions are off; everyone joins as Staff for now.
export const PERMISSIONS_ENABLED = false;

// Mirrors the server's activateInvitation rule (NIST minimum).
export const INVITE_PASSWORD_MIN_LENGTH = 8;

// Account-level role (AuthUser.role), not the per-tenant roles managed here.
export const ACCOUNT_ROLE_LABEL: Record<AuthUser["role"], string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  user: "User",
};

type BadgeVariant = "default" | "ok" | "warn" | "danger" | "muted" | "outline";

export const INVITATION_STATUS_BADGE: Record<InvitationStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Pending", variant: "warn" },
  accepted: { label: "Accepted", variant: "ok" },
  declined: { label: "Declined", variant: "muted" },
  revoked: { label: "Revoked", variant: "muted" },
};

export const MEMBERSHIP_STATUS_BADGE: Record<MembershipStatus, { label: string; variant: BadgeVariant }> = {
  active: { label: "Active", variant: "ok" },
  suspended: { label: "Suspended", variant: "muted" },
};
