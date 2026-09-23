// Shared constants for the team surface. The role name is meaningful to the UI (Super Admin is protected server-side, so its actions are hidden, not offered-then-refused) — mirrored here, not string-literalled per call site.

import type { InvitationStatus, MembershipStatus } from "@/types/access";
import type { AuthUser } from "@/types/auth";

export const SYSTEM_ROLE_SUPER_ADMIN = "Super Admin";

// The signed-in user's platform role (AuthUser.role), not the per-tenant Role records the team surface manages. Shown in the account menu and Profile page.
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
