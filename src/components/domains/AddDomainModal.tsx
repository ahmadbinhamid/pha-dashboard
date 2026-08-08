import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Modal, ModalContent, ModalHeader, ModalFooter, ModalTitle, ModalDescription } from "@/components/ui/Modal";
import { useToast } from "@/context";
import { createDomain } from "@/lib/api/domains";
import { addDomainSchema, type AddDomainFormValues } from "@/lib/validation/domain";

// Reference implementation for this app's react-hook-form + zod pattern:
// schema lives in src/lib/validation/*.ts (shared, reusable, independent of
// any one component), zodResolver wires it into RHF, and field errors flow
// into the existing FormField component exactly like the hand-rolled
// useState forms elsewhere already do — no visual/behavioral difference to
// the user, just a validated, typed form instead of a manually-checked one.
export function AddDomainModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddDomainFormValues>({
    resolver: zodResolver(addDomainSchema),
    defaultValues: { hostname: "" },
  });

  // Modal stays mounted between opens (Radix Dialog convention in this
  // app) — reset the form each time it closes so a re-open never shows the
  // previous attempt's value or error.
  useEffect(() => {
    if (!open) reset({ hostname: "" });
  }, [open, reset]);

  const createMutation = useMutation({
    mutationFn: (values: AddDomainFormValues) => createDomain(values.hostname),
    onSuccess: () => {
      toast({ title: "Domain added", description: "Add the DNS record shown to verify it.", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["domains"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      // Server-side rejection (e.g. "already registered") — surfaced on the
      // same field so it reads identically to a client-side validation error.
      setError("hostname", { message: err.message || "Could not add this domain" });
    },
  });

  const onSubmit = (values: AddDomainFormValues) => createMutation.mutate(values);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>
            <ModalTitle>Add domain</ModalTitle>
            <ModalDescription>
              Enter a domain you own — you'll need to add a DNS record to verify it before it's used.
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <FormField label="Domain" required error={errors.hostname?.message}>
              <Input {...register("hostname")} placeholder="e.g. shop.example.com" autoFocus />
            </FormField>
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="flex-1"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add domain"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
