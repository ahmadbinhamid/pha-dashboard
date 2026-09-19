import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Lock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { SettingsSection, SettingsFieldGrid } from "@/components/settings/SettingsSection";
import { PermissionMatrix } from "@/components/settings/team/PermissionMatrix";
import { useToast } from "@/context";
import { createRole, updateRole } from "@/lib/api/access";
import { roleFormSchema } from "@/lib/validation/access";
import type { PermissionGroup, Role } from "@/types/access";

/**
 * Create or edit one role. A system role opens read-only: the server refuses
 * to edit it (role.service.js), so the form shows what it grants rather than
 * pretending it can be changed.
 */
export function RoleEditor({
  role,
  groups,
  onDone,
}: {
  /** null = creating a new role. */
  role: Role | null;
  groups: PermissionGroup[];
  onDone: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setPermissions(role?.permissions ?? []);
    setError(null);
  }, [role]);

  const readOnly = Boolean(role?.is_system);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { name, description: description || null, permissions };
      return role ? updateRole(role._id, payload) : createRole(payload);
    },
    onSuccess: () => {
      toast({ title: role ? "Role updated" : "Role created", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      onDone();
    },
    onError: (err: Error) => setError(err.message || "Couldn't save this role"),
  });

  const save = () => {
    const parsed = roleFormSchema.safeParse({ name, description, permissions });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="gap-1.5 text-fg/60" onClick={onDone}>
        <ArrowLeft className="h-3.5 w-3.5" />
        All roles
      </Button>

      <SettingsSection
        title={role ? role.name : "New role"}
        description={
          readOnly
            ? "A built-in role. Its permissions are fixed so an organisation can't lock itself out."
            : "Name the role, then choose exactly what it can do."
        }
        right={readOnly ? <Badge variant="muted" className="gap-1.5"><Lock className="h-3 w-3" />Built in</Badge> : null}
        footer={
          readOnly ? null : (
            <>
              {error ? <span className="mr-auto text-xs font-medium text-danger">{error}</span> : null}
              <Button variant="ghost" onClick={onDone} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button variant="primary" onClick={save} disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : role ? "Save role" : "Create role"}
              </Button>
            </>
          )
        }
      >
        <div className="space-y-5">
          <SettingsFieldGrid>
            <FormField label="Role name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} placeholder="e.g. Warehouse Lead" />
            </FormField>
            <FormField label="Description" hint="What this role is for — shown when assigning it.">
              <Textarea
                rows={2}
                value={description ?? ""}
                onChange={(e) => setDescription(e.target.value)}
                disabled={readOnly}
                placeholder="Counts stock and picks orders, no pricing access."
              />
            </FormField>
          </SettingsFieldGrid>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-fg">Permissions</h3>
              <span className="text-xs text-fg/50">{permissions.length} selected</span>
            </div>
            <PermissionMatrix groups={groups} selected={permissions} onChange={setPermissions} readOnly={readOnly} />
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
