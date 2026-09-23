import { apiClient } from "./client";
import type { BeResponse } from "./base";
import type {
  Invitation,
  InvitationPreview,
  Member,
  MembershipStatus,
  MyOrganisation,
  PermissionGroup,
  Role,
} from "@/types/access";

// ── Members ─────────────────────────────────────────────────────────────────

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

export const getMyOrganisations = async () => {
  const { data } = await apiClient.get<BeResponse<MyOrganisation[]>>("/members/me/organisations");
  return data;
};

// ── Roles ───────────────────────────────────────────────────────────────────

export const getRoles = async () => {
  const { data } = await apiClient.get<BeResponse<Role[]>>("/roles");
  return data;
};

/** The catalogue the permission matrix renders from — served, not duplicated. */
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

// ── Invitations ─────────────────────────────────────────────────────────────

export const getInvitations = async () => {
  const { data } = await apiClient.get<BeResponse<Invitation[]>>("/invitations");
  return data;
};

/** The response carries `link`, the only moment a shareable link exists since the server stores only its hash. */
export const sendInvitation = async (payload: { email: string; role_id: string }) => {
  const { data } = await apiClient.post<BeResponse<Invitation>>("/invitations", payload);
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

// ── The invitee's side (public / newly signed-in) ───────────────────────────

export const getInvitationByToken = async (token: string) => {
  const { data } = await apiClient.get<BeResponse<InvitationPreview>>(`/invitations/token/${encodeURIComponent(token)}`);
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
