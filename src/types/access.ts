// Response shapes for the team surface — members, roles, invitations. Mirrors server/src/models/{Membership,Role,Invitation}.js and config/permissions.js.

export type MembershipStatus = "active" | "suspended";
export type InvitationStatus = "pending" | "accepted" | "declined" | "revoked";

/** One group in the permission matrix, served by GET /roles/permissions. */
export interface PermissionGroup {
  key: string;
  label: string;
  description: string;
  /** action -> human label, e.g. { view: "View orders" }. */
  actions: Record<string, string>;
}

export interface Role {
  _id: string;
  name: string;
  description: string | null;
  permissions: string[];
  /** Seeded with the organisation — can't be edited or deleted. */
  is_system: boolean;
  members_count?: number;
  created_at?: string;
}

/** The user side of a membership, as populated by the members endpoint. */
export interface MemberUser {
  _id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  profile_image: string | null;
  status: string;
  verified_at: string | null;
  last_login_at?: string | null;
}

/** A person's place in ONE organisation. */
export interface Member {
  _id: string;
  user_id: MemberUser;
  role_id: Pick<Role, "_id" | "name" | "description" | "is_system" | "permissions">;
  status: MembershipStatus;
  is_default: boolean;
  joined_at: string;
  last_active_at: string | null;
  invited_by: Pick<MemberUser, "_id" | "first_name" | "last_name" | "email"> | null;
}

export interface Invitation {
  _id: string;
  email: string;
  status: InvitationStatus;
  role_id: Pick<Role, "_id" | "name" | "is_system"> | null;
  invited_by: Pick<MemberUser, "_id" | "first_name" | "last_name" | "email"> | null;
  /** Expiry is not a status — a pending invite past its date reports this. */
  is_expired: boolean;
  expires_at: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
  /** Only present in the response to sending or resending — see below. */
  link?: string;
}

/** What the public invite landing page renders before anyone signs in. */
export interface InvitationPreview {
  email: string;
  status: InvitationStatus;
  expires_at: string | null;
  organisation: { _id: string; name: string; company_name: string | null; logo_url: string | null };
  role: { _id: string; name: string } | null;
  invited_by: { name: string } | null;
  /** Lets the page go straight to sign-in or sign-up. */
  has_account: boolean;
}

/** One organisation the signed-in user belongs to — the org switcher's row. */
export interface MyOrganisation {
  _id: string;
  tenant_id: { _id: string; name: string; company_name: string | null; slug: string; logo_url: string | null };
  role_id: Pick<Role, "_id" | "name" | "is_system">;
  is_default: boolean;
  joined_at: string;
}
