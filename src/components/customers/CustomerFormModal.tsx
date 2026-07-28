import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Checkbox } from "@/components/ui/Checkbox";
import { AddressFields } from "@/components/pos/AddressFields";
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
import type { OrderAddress } from "@/types/orders";

const EMPTY_ADDRESS: OrderAddress = { address: "", suburb: "", state: "", postcode: "" };

const EMPTY_FORM: CustomerFormState = {
  name: "",
  email: "",
  phone: "",
  shippingAddress: EMPTY_ADDRESS,
  useDifferentBilling: false,
  billingAddress: EMPTY_ADDRESS,
};

// Digits plus common phone punctuation — no letters, mirrors the backend's
// PHONE_PATTERN in customer.validation.js.
const PHONE_PATTERN = /^[\d\s\-()+]*$/;

function isAddressFilled(a: OrderAddress) {
  return !!(a.address.trim() || a.suburb.trim() || a.state.trim() || a.postcode.trim());
}

function customerToForm(c: Customer): CustomerFormState {
  return {
    name: c.name,
    email: c.email ?? "",
    phone: c.phone ?? "",
    shippingAddress: c.shipping_address ?? EMPTY_ADDRESS,
    useDifferentBilling: !!c.billing_address,
    billingAddress: c.billing_address ?? EMPTY_ADDRESS,
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
    const shippingFilled = isAddressFilled(form.shippingAddress);
    return {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      shipping_address: shippingFilled ? form.shippingAddress : null,
      billing_address: form.useDifferentBilling ? form.billingAddress : null,
    };
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Customer name is required";
    if (!PHONE_PATTERN.test(form.phone)) nextErrors.phone = "Phone number cannot contain letters";

    const shippingFilled = isAddressFilled(form.shippingAddress);
    if (shippingFilled) {
      if (!form.shippingAddress.address.trim()) nextErrors.address = "Address is required";
      if (!form.shippingAddress.suburb.trim()) nextErrors.suburb = "Suburb is required";
      if (!form.shippingAddress.state.trim()) nextErrors.state = "State is required";
      if (!form.shippingAddress.postcode.trim()) nextErrors.postcode = "Postcode is required";
    }
    if (form.useDifferentBilling) {
      if (!form.billingAddress.address.trim()) nextErrors.billingAddress = "Billing address is required";
      if (!form.billingAddress.suburb.trim()) nextErrors.billingSuburb = "Billing suburb is required";
      if (!form.billingAddress.state.trim()) nextErrors.billingState = "Billing state is required";
      if (!form.billingAddress.postcode.trim()) nextErrors.billingPostcode = "Billing postcode is required";
    }

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
      <ModalContent className="max-w-xl">
        <form onSubmit={handleSubmit} className="max-h-[80vh] space-y-5 overflow-y-auto pr-1">
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

            <div className="space-y-4 border-t border-dashed border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-fg/45">Shipping address</p>
              <AddressFields
                value={form.shippingAddress}
                onChange={(a) => setForm((f) => ({ ...f, shippingAddress: a }))}
                errors={{
                  address: errors.address,
                  suburb: errors.suburb,
                  state: errors.state,
                  postcode: errors.postcode,
                }}
                required={false}
              />

              <Checkbox
                label="Use a different billing address"
                checked={form.useDifferentBilling}
                onChange={(e) => setForm((f) => ({ ...f, useDifferentBilling: e.target.checked }))}
              />

              {form.useDifferentBilling && (
                <AddressFields
                  value={form.billingAddress}
                  onChange={(a) => setForm((f) => ({ ...f, billingAddress: a }))}
                  errors={{
                    address: errors.billingAddress,
                    suburb: errors.billingSuburb,
                    state: errors.billingState,
                    postcode: errors.billingPostcode,
                  }}
                  required={false}
                />
              )}
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
