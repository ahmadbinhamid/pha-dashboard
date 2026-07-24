import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/Modal";
import { useToast } from "@/context";
import { createCustomer, updateCustomer } from "@/lib/api/customers";
import type { CustomerPayload } from "@/lib/api/customers";
import type { Customer, CustomerFormState } from "@/types/customer";

const EMPTY_FORM: CustomerFormState = { name: "", email: "", phone: "" };

// Digits plus common phone punctuation — no letters, mirrors the backend's
// PHONE_PATTERN in customer.validation.js.
const PHONE_PATTERN = /^[\d\s\-()+]*$/;

function customerToForm(c: Customer): CustomerFormState {
  return {
    name: c.name,
    email: c.email ?? "",
    phone: c.phone ?? "",
  };
}

interface CustomerFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // null => create mode
  customer: Customer | null;
  // Prefills the Name field in create mode — e.g. carrying over what staff
  // already typed into a customer search that came up empty.
  initialName?: string;
  // Called with the newly created customer, in addition to the default
  // toast/invalidate/close — lets callers (e.g. the POS create-order flow)
  // auto-select the customer they just created.
  onCreated?: (customer: Customer) => void;
}

// Shared create/edit form — rendered from both the customer list page and
// the customer profile page so the two never drift out of sync.
export function CustomerFormModal({ open, onOpenChange, customer, initialName, onCreated }: CustomerFormModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CustomerFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm(customer ? customerToForm(customer) : { ...EMPTY_FORM, name: initialName ?? "" });
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    if (customer) queryClient.invalidateQueries({ queryKey: ["customer", customer._id] });
  };

  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: (res) => {
      toast({ title: "Customer created", tone: "success" });
      invalidate();
      onOpenChange(false);
      if (res.data) onCreated?.(res.data);
    },
    onError: (err: Error) => {
      toast({ title: "Create failed", description: err.message, tone: "danger" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CustomerPayload }) => updateCustomer(id, payload),
    onSuccess: () => {
      toast({ title: "Customer updated", tone: "success" });
      invalidate();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, tone: "danger" });
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function buildPayload(): CustomerPayload {
    return {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    };
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Customer name is required";
    if (!PHONE_PATTERN.test(form.phone)) nextErrors.phone = "Phone number cannot contain letters";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    const payload = buildPayload();
    if (customer) {
      updateMutation.mutate({ id: customer._id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <form onSubmit={handleSubmit}>
          <ModalHeader>
            <ModalTitle>{customer ? "Edit customer" : "New customer"}</ModalTitle>
            <ModalDescription>
              {customer ? "Update this customer's details." : "Add a new customer record."}
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <FormField label="Name" required error={errors.name}>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Wesley England"
                autoFocus
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="customer@example.com"
                />
              </FormField>
              <FormField label="Phone" error={errors.phone}>
                <Input
                  value={form.phone}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (PHONE_PATTERN.test(value)) setForm((f) => ({ ...f, phone: value }));
                  }}
                  placeholder="0412 345 678"
                />
              </FormField>
            </div>
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="flex-1"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" className="flex-1" disabled={isSaving}>
              {isSaving ? "Saving…" : customer ? "Save changes" : "Create customer"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
