import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { Modal, ModalContent, ModalHeader, ModalFooter, ModalTitle, ModalDescription } from "@/components/ui/Modal";
import { useToast } from "@/context";
import { updateMember } from "@/lib/api/access";
import { SYSTEM_ROLE_SUPER_ADMIN } from "@/config/access";
import type { Member, Role } from "@/types/access";

/** Changes the role in this organisation only (membership.service.js). */
export function ChangeRoleModal({
  member,
  roles,
  onOpenChange,
}: {
  /** null closes it; the member being edited opens it. */
  member: Member | null;
  roles: Role[];
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [roleId, setRoleId] = useState("");

  useEffect(() => {
    setRoleId(member?.role_id?._id ?? "");
  }, [member]);

  const mutation = useMutation({
    mutationFn: () => updateMember(member!.user_id._id, { role_id: roleId }),
    onSuccess: () => {
      toast({ title: "Role updated", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ title: "Couldn't change the role", description: err.message, tone: "danger" }),
  });

  const name = member ? `${member.user_id.first_name} ${member.user_id.last_name}`.trim() || member.user_id.email : "";

  return (
    <Modal open={Boolean(member)} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Change role</ModalTitle>
          <ModalDescription>
            {name ? `What ${name} can do in this organisation. Their access elsewhere is unaffected.` : ""}
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-4">
          <FormField label="Role" required>
            <SingleSelect
              options={roles
                // Super Admin can't be granted here: it can't be edited or removed later.
                .filter((role) => role.name !== SYSTEM_ROLE_SUPER_ADMIN)
                .map((role) => ({ value: role._id, label: role.name }))}
              value={roleId}
              onChange={setRoleId}
              placeholder="Select a role…"
            />
          </FormField>
        </div>

        <ModalFooter>
          <Button type="button" variant="secondary" size="md" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            className="flex-1"
            disabled={mutation.isPending || !roleId || roleId === member?.role_id?._id}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saving…" : "Save role"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
