import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { Modal, ModalContent, ModalHeader, ModalFooter, ModalTitle, ModalDescription } from "@/components/ui/Modal";
import { useToast } from "@/context";
import { sendInvitation } from "@/lib/api/access";
import { inviteMemberSchema, type InviteMemberFormValues } from "@/lib/validation/access";
import type { Invitation, Role } from "@/types/access";

/** Re-inviting a pending/declined/revoked address reopens that invite. */
export function InviteMemberModal({
  open,
  onOpenChange,
  roles,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: Role[];
  /** Hands back the link, which exists only in this response. */
  onSent: (invitation: Invitation) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberFormValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", role_id: "" },
  });

  // Modal stays mounted between opens, so reset on close for a clean reopen.
  useEffect(() => {
    if (!open) reset({ email: "", role_id: "" });
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: InviteMemberFormValues) => sendInvitation(values),
    onSuccess: (res) => {
      toast({ title: "Invitation sent", description: "They'll get an email with a link to join.", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      if (res.data) onSent(res.data);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      // e.g. "already a member" — shown on the field it's about.
      setError("email", { message: err.message || "Could not send this invitation" });
    },
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <ModalHeader>
            <ModalTitle>Invite a team member</ModalTitle>
            <ModalDescription>
              They'll get an email with a link to join this organisation. The link works once, for that address only.
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <FormField label="Email address" required error={errors.email?.message}>
              <Input {...register("email")} type="email" placeholder="name@example.com" autoFocus />
            </FormField>

            <FormField label="Role" required error={errors.role_id?.message} hint="What they'll be able to do here.">
              <Controller
                control={control}
                name="role_id"
                render={({ field }) => (
                  <SingleSelect
                    options={roles.map((role) => ({ value: role._id, label: role.name }))}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Choose a role…"
                  />
                )}
              />
            </FormField>
          </div>

          <ModalFooter>
            <Button type="button" variant="secondary" size="md" className="flex-1" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" className="flex-1" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? "Sending…" : "Send invitation"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
