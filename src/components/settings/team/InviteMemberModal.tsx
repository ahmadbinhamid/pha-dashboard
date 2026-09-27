import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal, ModalContent, ModalHeader, ModalFooter, ModalTitle, ModalDescription } from "@/components/ui/Modal";
import { useToast } from "@/context";
import { sendInvitation } from "@/lib/api/access";
import { inviteMemberSchema, type InviteMemberFormValues } from "@/lib/validation/access";

const EMPTY_FORM: InviteMemberFormValues = { first_name: "", last_name: "", email: "" };

// Adds a teammate as Staff; new emails get a link to set their password.
export function InviteMemberModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberFormValues>({ resolver: zodResolver(inviteMemberSchema), defaultValues: EMPTY_FORM });

  // Stays mounted between opens, so reset on close for a clean reopen.
  useEffect(() => {
    if (!open) reset(EMPTY_FORM);
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: sendInvitation,
    onSuccess: (res, values) => {
      const added = res.data?.mode === "added";
      toast({
        title: added ? "Added to your team" : "Invite sent",
        description: added
          ? `${values.email} already had an account; they can sign in and switch to this organisation.`
          : `${values.email} will get an email to set their password.`,
        tone: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      onOpenChange(false);
    },
    // e.g. "already a member", shown on the field it's about.
    onError: (err: Error) => setError("email", { message: err.message || "Could not add this person" }),
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <ModalHeader>
            <ModalTitle>Add a team member</ModalTitle>
            <ModalDescription>
              They join as Staff. A new email gets a link to set a password; an existing account is added straight away.
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="First name" required error={errors.first_name?.message}>
                <Input {...register("first_name")} autoComplete="off" autoFocus />
              </FormField>
              <FormField label="Last name" required error={errors.last_name?.message}>
                <Input {...register("last_name")} autoComplete="off" />
              </FormField>
            </div>
            <FormField label="Email address" required error={errors.email?.message}>
              <Input {...register("email")} type="email" placeholder="name@example.com" autoComplete="off" />
            </FormField>
          </div>

          <ModalFooter>
            <Button type="button" variant="secondary" size="md" className="flex-1" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" className="flex-1" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? "Sending…" : "Send invite"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
