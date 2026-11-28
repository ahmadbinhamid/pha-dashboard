import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { TagInput } from "@/components/ui/TagInput";
import { useToast } from "@/context";
import { CONTACTS_QUERY_KEY, createContact, updateContact } from "@/lib/api/campaigns";
import { contactFormSchema, type ContactFormValues } from "@/lib/validation/campaign";
import type { Contact } from "@/types/campaign";

interface ContactFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Null adds a new contact.
  contact: Contact | null;
}

const toFormValues = (c: Contact | null): ContactFormValues => ({
  email: c?.email ?? "",
  first_name: c?.first_name ?? "",
  last_name: c?.last_name ?? "",
  lists: c?.lists ?? [],
});

export function ContactFormModal({ open, onOpenChange, contact }: ContactFormModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isNew = !contact;
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: toFormValues(contact),
  });

  useEffect(() => {
    if (open) reset(toFormValues(contact));
  }, [open, contact, reset]);

  const mutation = useMutation({
    mutationFn: (v: ContactFormValues) => {
      const fields = { first_name: v.first_name || null, last_name: v.last_name || null, lists: v.lists };
      return isNew ? createContact({ ...fields, email: v.email }) : updateContact(contact._id, fields);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
      toast({ title: isNew ? "Contact added" : "Contact saved", tone: "success" });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ title: "Couldn't save the contact", description: err.message, tone: "danger" }),
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>{isNew ? "Add contact" : "Edit contact"}</ModalTitle>
          <ModalDescription>
            {isNew ? "Only add people who agreed to hear from you." : contact.email}
          </ModalDescription>
        </ModalHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          {isNew ? (
            <FormField label="Email" required error={errors.email?.message}>
              <Input type="email" {...register("email")} placeholder="name@example.com" autoFocus />
            </FormField>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First name" error={errors.first_name?.message}>
              <Input {...register("first_name")} />
            </FormField>
            <FormField label="Last name" error={errors.last_name?.message}>
              <Input {...register("last_name")} />
            </FormField>
          </div>
          <FormField label="Lists" hint="Press Enter after each list name">
            <Controller
              control={control}
              name="lists"
              render={({ field }) => <TagInput value={field.value} onChange={field.onChange} placeholder="e.g. VIP, Mechanics" />}
            />
          </FormField>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={mutation.isPending}>
              {isNew ? "Add contact" : "Save"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
