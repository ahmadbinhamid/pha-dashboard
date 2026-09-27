import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type {
  Invitation,
  InvitationPreview,
  InviteResult,
  MyAccess,
  Member,
  MembershipStatus,
  MyOrganisation,
  PermissionGroup,
  Role,
} from "@/types/access";

// ── Members ──

export const getMembers = async () => {
  const { data } = await apiClient.get<BeResponse<Member[]>>("/members");
  return data;
};

/** Change a member's role, or suspend/restore their access. */
export const updateMember = async (userId: string, payload: { role_id?: string; status?: MembershipStatus }) => {
  const { data } = await apiClient.patch<BeResponse<Member>>(`/members/${userId}`, payload);
  return data;
};

/** Removes them from THIS organisation only — the account survives. */
export const removeMember = async (userId: string) => {
  const { data } = await apiClient.delete<BeResponse<null>>(`/members/${userId}`);
  return data;
};

export const MY_ACCESS_QUERY_KEY = ["my-access"] as const;

export const getMyAccess = async () => {
  const { data } = await apiClient.get<BeResponse<MyAccess>>("/members/me/access");
  return data;
};

export const getMyOrganisations = async () => {
  const { data } = await apiClient.get<BeResponse<MyOrganisation[]>>("/members/me/organisations");
  return data;
};

// ── Roles ──

export const getRoles = async () => {
  const { data } = await apiClient.get<BeResponse<Role[]>>("/roles");
  return data;
};

/** The permission catalogue the matrix renders from (served, not copied). */
export const getPermissionGroups = async () => {
  const { data } = await apiClient.get<BeResponse<PermissionGroup[]>>("/roles/permissions");
  return data;
};

export const getRole = async (id: string) => {
  const { data } = await apiClient.get<BeResponse<Role>>(`/roles/${id}`);
  return data;
};

export const createRole = async (payload: { name: string; description?: string | null; permissions: string[] }) => {
  const { data } = await apiClient.post<BeResponse<Role>>("/roles", payload);
  return data;
};

export const updateRole = async (
  id: string,
  payload: { name?: string; description?: string | null; permissions?: string[] },
) => {
  const { data } = await apiClient.put<BeResponse<Role>>(`/roles/${id}`, payload);
  return data;
};

export const deleteRole = async (id: string) => {
  const { data } = await apiClient.delete<BeResponse<null>>(`/roles/${id}`);
  return data;
};

// ── Invitations ──

export const getInvitations = async () => {
  const { data } = await apiClient.get<BeResponse<Invitation[]>>("/invitations");
  return data;
};

/** Adds someone with a role; the result says if they were invited or added. */
export const sendInvitation = async (payload: { first_name: string; last_name: string; email: string; role_id?: string }) => {
  const { data } = await apiClient.post<BeResponse<InviteResult>>("/invitations", payload);
  return data;
};

export const resendInvitation = async (id: string) => {
  const { data } = await apiClient.post<BeResponse<Invitation>>(`/invitations/${id}/resend`, {});
  return data;
};

export const revokeInvitation = async (id: string) => {
  const { data } = await apiClient.delete<BeResponse<Invitation>>(`/invitations/${id}`);
  return data;
};

// ── The invitee's side (public or newly signed in) ──

export const getInvitationByToken = async (token: string) => {
  const { data } = await apiClient.get<BeResponse<InvitationPreview>>(`/invitations/token/${encodeURIComponent(token)}`);
  return data;
};

/** Sets a new member's first password from their invite link. */
export const activateInvitation = async (token: string, password: string) => {
  const { data } = await apiClient.post<BeResponse<{ email: string }>>(`/invitations/token/${encodeURIComponent(token)}/activate`, { password });
  return data;
};

export const acceptInvitation = async (token: string) => {
  const { data } = await apiClient.post<BeResponse<Invitation>>(`/invitations/token/${encodeURIComponent(token)}/accept`, {});
  return data;
};

export const declineInvitation = async (token: string) => {
  const { data } = await apiClient.post<BeResponse<Invitation>>(`/invitations/token/${encodeURIComponent(token)}/decline`, {});
  return data;
};

export const registerFromInvitation = async (
  token: string,
  payload: { first_name: string; last_name: string; password: string; phone?: string | null },
) => {
  const { data } = await apiClient.post<BeResponse<{ user: MemberUserLike; token: string }>>(
    `/invitations/token/${encodeURIComponent(token)}/register`,
    payload,
  );
  return data;
};

type MemberUserLike = { _id: string; email: string; first_name: string; last_name: string };
