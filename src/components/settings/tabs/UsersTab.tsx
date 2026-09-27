import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Mail, UserPlus, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
} from "@/components/ui/Table";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/Modal";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { MemberRow } from "@/components/settings/team/MemberRow";
import { InvitationRow } from "@/components/settings/team/InvitationRow";
import { InviteMemberModal } from "@/components/settings/team/InviteMemberModal";
import { ChangeRoleModal } from "@/components/settings/team/ChangeRoleModal";
import { useToast } from "@/context";
import { useAuth } from "@/context";
import {
  getInvitations,
  getMembers,
  getRoles,
  removeMember,
  resendInvitation,
  revokeInvitation,
  updateMember,
} from "@/lib/api/access";
import { PERMISSIONS_ENABLED } from "@/config/access";
import { useMyAccess } from "@/hooks/useMyAccess";
import type { Invitation, Member } from "@/types/access";

export function UsersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // Team management is the tenant Admin's; Staff get a read-only list.
  const { isTenantAdmin, isLoading: accessLoading } = useMyAccess();

  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<Member | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const { data: membersRes, isLoading: membersLoading } = useQuery({
    queryKey: ["members"],
    queryFn: getMembers,
    enabled: isTenantAdmin,
  });
  const { data: invitesRes, isLoading: invitesLoading } = useQuery({
    queryKey: ["invitations"],
    queryFn: getInvitations,
    enabled: isTenantAdmin,
  });
  // Roles only matter for changing a role, which waits on permissions.
  const { data: rolesRes } = useQuery({
    queryKey: ["roles"],
    queryFn: getRoles,
    enabled: isTenantAdmin && PERMISSIONS_ENABLED,
  });

  const members = membersRes?.data ?? [];
  const invitations = invitesRes?.data ?? [];
  const roles = rolesRes?.data ?? [];

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members;
    return members.filter((m) => {
      const u = m.user_id;
      return (
        `${u?.first_name ?? ""} ${u?.last_name ?? ""}`
          .toLowerCase()
          .includes(term) ||
        (u?.email ?? "").toLowerCase().includes(term) ||
        (m.role_id?.name ?? "").toLowerCase().includes(term)
      );
    });
  }, [members, search]);

  // Accepted and revoked invites are history; show only what's in flight.
  const openInvitations = useMemo(
    () => invitations.filter((i) => i.status !== "accepted"),
    [invitations],
  );

  const suspendMutation = useMutation({
    mutationFn: (member: Member) =>
      updateMember(member.user_id._id, {
        status: member.status === "suspended" ? "active" : "suspended",
      }),
    onSuccess: (_res, member) => {
      toast({
        title:
          member.status === "suspended"
            ? "Access restored"
            : "Access suspended",
        tone: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (err: Error) =>
      toast({
        title: "Couldn't update access",
        description: err.message,
        tone: "danger",
      }),
  });

  const removeMutation = useMutation({
    mutationFn: (member: Member) => removeMember(member.user_id._id),
    onSuccess: () => {
      toast({
        title: "Member removed",
        description: "Their account and any other organisations are untouched.",
        tone: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setRemoveTarget(null);
    },
    onError: (err: Error) =>
      toast({
        title: "Couldn't remove this member",
        description: err.message,
        tone: "danger",
      }),
  });

  const resendMutation = useMutation({
    mutationFn: (invitation: Invitation) => resendInvitation(invitation._id),
    onSuccess: () => {
      toast({
        title: "Invite sent again",
        description: "The previous link no longer works.",
        tone: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    // The server says how long to wait when it's within the cooldown.
    onError: (err: Error) =>
      toast({
        title: "Couldn't resend yet",
        description: err.message,
        tone: "danger",
      }),
  });

  const revokeMutation = useMutation({
    mutationFn: (invitation: Invitation) => revokeInvitation(invitation._id),
    onSuccess: () => {
      toast({
        title: "Invite cancelled",
        description: "The link no longer works.",
        tone: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
      void queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (err: Error) =>
      toast({
        title: "Couldn't revoke",
        description: err.message,
        tone: "danger",
      }),
  });

  if (!accessLoading && !isTenantAdmin) {
    return (
      <SettingsSection
        title="Members"
        description="People who can sign in to this organisation."
      >
        <EmptyState
          icon={Lock}
          title="Only your organisation's Admin manages the team"
          description="Ask them to add or remove people."
        />
      </SettingsSection>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Members"
        description="People who can sign in to this organisation. New members join as Staff."
        right={
          <Button
            variant="primary"
            size="sm"
            className="gap-1.5"
            onClick={() => setInviteOpen(true)}
          >
            <UserPlus className="h-4 w-4" />
            Add Team Member
          </Button>
        }
      >
        <div className="space-y-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or role…"
            className="max-w-sm"
          />

          {membersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : filteredMembers.length === 0 ? (
            <EmptyState
              icon={Users}
              title={
                search ? "No one matches that search" : "It's just you so far"
              }
              description={
                search
                  ? "Try a different name, email or role."
                  : "Invite a teammate to give them access."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last active</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <MemberRow
                      key={member._id}
                      member={member}
                      isSelf={String(member.user_id?._id) === String(user?._id)}
                      canManage={isTenantAdmin}
                      onChangeRole={setRoleTarget}
                      onToggleSuspended={(m) => suspendMutation.mutate(m)}
                      onRemove={setRemoveTarget}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Pending Invitations"
        description="Waiting for the person to set a password. Links last 24 hours; resending sends a fresh one and cancels the old."
      >
        {invitesLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : openInvitations.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No invitations outstanding"
            description="Anyone you add appears here until they set a password."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invitee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openInvitations.map((invitation) => (
                  <InvitationRow
                    key={invitation._id}
                    invitation={invitation}
                    canManage={isTenantAdmin}
                    onResend={(i) => resendMutation.mutate(i)}
                    onRevoke={(i) => revokeMutation.mutate(i)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SettingsSection>

      <InviteMemberModal open={inviteOpen} onOpenChange={setInviteOpen} />
      {PERMISSIONS_ENABLED && (
        <ChangeRoleModal
          member={roleTarget}
          roles={roles}
          onOpenChange={(open) => !open && setRoleTarget(null)}
        />
      )}

      <Modal
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Remove from organisation?</ModalTitle>
            <ModalDescription>
              {removeTarget
                ? `${removeTarget.user_id.email} will lose access to this organisation immediately. Their account, and any other organisation they belong to, are untouched — and you can invite them back.`
                : ""}
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="flex-1"
              onClick={() => setRemoveTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="md"
              className="flex-1"
              disabled={removeMutation.isPending}
              onClick={() =>
                removeTarget && removeMutation.mutate(removeTarget)
              }
            >
              {removeMutation.isPending ? "Removing…" : "Remove member"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
