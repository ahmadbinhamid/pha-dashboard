import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, TableHeader, TableRow, TableHead, TableBody } from "@/components/ui/Table";
import { Modal, ModalContent, ModalHeader, ModalFooter, ModalTitle, ModalDescription } from "@/components/ui/Modal";
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
import type { Invitation, Member } from "@/types/access";

export function UsersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<Member | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  // A link exists only in the response that minted it (server keeps just its hash), so it's held here for the session and nowhere else.
  const [links, setLinks] = useState<Record<string, string>>({});

  const { data: membersRes, isLoading: membersLoading } = useQuery({ queryKey: ["members"], queryFn: getMembers });
  const { data: invitesRes, isLoading: invitesLoading } = useQuery({ queryKey: ["invitations"], queryFn: getInvitations });
  const { data: rolesRes } = useQuery({ queryKey: ["roles"], queryFn: getRoles });

  const members = membersRes?.data ?? [];
  const invitations = invitesRes?.data ?? [];
  const roles = rolesRes?.data ?? [];

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members;
    return members.filter((m) => {
      const u = m.user_id;
      return (
        `${u?.first_name ?? ""} ${u?.last_name ?? ""}`.toLowerCase().includes(term) ||
        (u?.email ?? "").toLowerCase().includes(term) ||
        (m.role_id?.name ?? "").toLowerCase().includes(term)
      );
    });
  }, [members, search]);

  // Accepted and revoked invites are history; this list is only what's still in flight.
  const openInvitations = useMemo(() => invitations.filter((i) => i.status !== "accepted"), [invitations]);

  const rememberLink = (invitation: Invitation) => {
    if (invitation.link) setLinks((prev) => ({ ...prev, [invitation._id]: invitation.link! }));
  };

  const suspendMutation = useMutation({
    mutationFn: (member: Member) =>
      updateMember(member.user_id._id, { status: member.status === "suspended" ? "active" : "suspended" }),
    onSuccess: (_res, member) => {
      toast({ title: member.status === "suspended" ? "Access restored" : "Access suspended", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (err: Error) => toast({ title: "Couldn't update access", description: err.message, tone: "danger" }),
  });

  const removeMutation = useMutation({
    mutationFn: (member: Member) => removeMember(member.user_id._id),
    onSuccess: () => {
      toast({ title: "Member removed", description: "Their account and any other organisations are untouched.", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setRemoveTarget(null);
    },
    onError: (err: Error) => toast({ title: "Couldn't remove this member", description: err.message, tone: "danger" }),
  });

  const resendMutation = useMutation({
    mutationFn: (invitation: Invitation) => resendInvitation(invitation._id),
    onSuccess: (res) => {
      toast({ title: "Invitation sent again", description: "The previous link no longer works.", tone: "success" });
      if (res.data) rememberLink(res.data);
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (err: Error) => toast({ title: "Couldn't resend", description: err.message, tone: "danger" }),
  });

  const revokeMutation = useMutation({
    mutationFn: (invitation: Invitation) => revokeInvitation(invitation._id),
    onSuccess: () => {
      toast({ title: "Invitation revoked", description: "The link has been deactivated.", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (err: Error) => toast({ title: "Couldn't revoke", description: err.message, tone: "danger" }),
  });

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Members"
        description="People who can sign in to this organisation. Each holds one role here, independent of any other organisation they belong to."
        right={
          <Button variant="primary" size="sm" className="gap-1.5" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Invite Team Member
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
              icon={<Users className="h-8 w-8 text-fg/30" />}
              title={search ? "No one matches that search" : "It's just you so far"}
              description={search ? "Try a different name, email or role." : "Invite a teammate to give them access."}
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
        description="One invitation per address — inviting someone again reopens theirs with a fresh link rather than adding a second."
      >
        {invitesLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : openInvitations.length === 0 ? (
          <EmptyState
            icon={<Mail className="h-8 w-8 text-fg/30" />}
            title="No invitations outstanding"
            description="Anyone you invite will appear here until they accept."
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
                    link={links[invitation._id]}
                    onResend={(i) => resendMutation.mutate(i)}
                    onRevoke={(i) => revokeMutation.mutate(i)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SettingsSection>

      <InviteMemberModal open={inviteOpen} onOpenChange={setInviteOpen} roles={roles} onSent={rememberLink} />
      <ChangeRoleModal member={roleTarget} roles={roles} onOpenChange={(open) => !open && setRoleTarget(null)} />

      <Modal open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}>
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
            <Button type="button" variant="secondary" size="md" className="flex-1" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="md"
              className="flex-1"
              disabled={removeMutation.isPending}
              onClick={() => removeTarget && removeMutation.mutate(removeTarget)}
            >
              {removeMutation.isPending ? "Removing…" : "Remove member"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-xs border border-border bg-bg-2">{icon}</div>
      <div>
        <p className="font-medium text-fg">{title}</p>
        <p className="mt-1 text-sm text-fg/50">{description}</p>
      </div>
    </div>
  );
}
