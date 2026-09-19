// Shared constants for the team surface. The role NAME is meaningful to the
// UI (Super Admin is protected server-side, so its actions are hidden rather
// than offered and refused) — mirrored here rather than string-literalled at
// each call site.

import type { InvitationStatus, MembershipStatus } from "@/types/access";

export const SYSTEM_ROLE_SUPER_ADMIN = "Super Admin";

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
