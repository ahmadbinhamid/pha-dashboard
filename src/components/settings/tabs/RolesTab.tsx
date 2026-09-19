import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, MoreHorizontal, Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/Table";
import { Modal, ModalContent, ModalHeader, ModalFooter, ModalTitle, ModalDescription } from "@/components/ui/Modal";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/ActionsMenu";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { RoleEditor } from "@/components/settings/team/RoleEditor";
import { useToast } from "@/context";
import { deleteRole, getPermissionGroups, getRoles } from "@/lib/api/access";
import type { Role } from "@/types/access";

export function RolesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // null = list; { role: null } = creating; { role } = editing.
  const [editing, setEditing] = useState<{ role: Role | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const { data: rolesRes, isLoading } = useQuery({ queryKey: ["roles"], queryFn: getRoles });
  const { data: groupsRes } = useQuery({ queryKey: ["permission-groups"], queryFn: getPermissionGroups });

  const roles = rolesRes?.data ?? [];
  const groups = groupsRes?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (role: Role) => deleteRole(role._id),
    onSuccess: () => {
      toast({ title: "Role deleted", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast({ title: "Couldn't delete this role", description: err.message, tone: "danger" }),
  });

  if (editing) {
    return <RoleEditor role={editing.role} groups={groups} onDone={() => setEditing(null)} />;
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Roles & Permissions"
        description="Every member holds one role in this organisation, and the role decides what they can reach."
        right={
          <Button variant="primary" size="sm" className="gap-1.5" onClick={() => setEditing({ role: null })}>
            <Plus className="h-4 w-4" />
            New role
          </Button>
        }
      >
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role._id}>
                    <TableCell>
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                          <Shield className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-fg">{role.name}</span>
                            {role.is_system ? (
                              <Badge variant="muted" className="gap-1">
                                <Lock className="h-2.5 w-2.5" />
                                Built in
                              </Badge>
                            ) : null}
                          </div>
                          {role.description ? <div className="truncate text-xs text-fg/50">{role.description}</div> : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-fg/70">{role.members_count ?? 0}</TableCell>
                    <TableCell className="text-sm text-fg/70">{role.permissions.length}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger aria-label={`Actions for ${role.name}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditing({ role })}>
                            <Pencil className="h-3.5 w-3.5 text-fg/50" />
                            {role.is_system ? "View permissions" : "Edit role"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            destructive
                            // Both are refused server-side too — a built-in
                            // role, or one someone still holds.
                            disabled={role.is_system || (role.members_count ?? 0) > 0}
                            onSelect={() => setDeleteTarget(role)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete role
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SettingsSection>

      <Modal open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Delete this role?</ModalTitle>
            <ModalDescription>
              {deleteTarget ? `"${deleteTarget.name}" will be removed. Nobody currently holds it, so no one loses access.` : ""}
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button type="button" variant="secondary" size="md" className="flex-1" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="md"
              className="flex-1"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete role"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
