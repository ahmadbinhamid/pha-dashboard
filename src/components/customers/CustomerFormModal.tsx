import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Combobox } from "@/components/ui/Combobox";
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
import { BUSINESSES_QUERY_KEY, getBusinessOptions } from "@/lib/api/businesses";
import type { CustomerPayload } from "@/lib/api/customers";
import type { Customer } from "@/types/customer";
import { customerFormSchema, type CustomerFormValues } from "@/lib/validation/customer";
import { EMPTY_ADDRESS, isAddressFilled } from "@/lib/validation/address";

const EMPTY_FORM: CustomerFormValues = {
  name: "",
  businessName: "",
  email: "",
  phone: "",
  shippingAddress: EMPTY_ADDRESS,
  useDifferentBilling: false,
  billingAddress: EMPTY_ADDRESS,
};

function customerToForm(c: Customer): CustomerFormValues {
  return {
    name: c.name,
    businessName: c.business?.name ?? "",
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
  // Create-mode prefill, e.g. from a customer search that came up empty.
  initialName?: string;
  // Create-mode prefill, for adding another rep to an existing business.
  initialBusinessName?: string;
  // Runs after the default toast and close, e.g. so POS can auto-select it.
  onCreated?: (customer: Customer) => void;
}

// Shared by the list and profile pages so the two forms never drift.
export function CustomerFormModal({
  open,
  onOpenChange,
  customer,
  initialName,
  initialBusinessName,
  onCreated,
}: CustomerFormModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: EMPTY_FORM,
  });

  const useDifferentBilling = watch("useDifferentBilling");

  const { data: businessesRes } = useQuery({
    queryKey: [...BUSINESSES_QUERY_KEY, "options"],
    queryFn: getBusinessOptions,
    enabled: open,
  });
  const businessNames = (businessesRes?.data ?? []).map((b) => b.name);

  useEffect(() => {
    if (open) {
      reset(
        customer
          ? customerToForm(customer)
          : { ...EMPTY_FORM, name: initialName ?? "", businessName: initialBusinessName ?? "" },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["customers"] });
    void queryClient.invalidateQueries({ queryKey: BUSINESSES_QUERY_KEY });
    // Every open profile, since a rep's change shows on fellow reps' pages.
    void queryClient.invalidateQueries({ queryKey: ["customer"] });
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

  function buildPayload(values: CustomerFormValues): CustomerPayload {
    return {
      name: values.name.trim(),
      business_name: values.businessName.trim() || null,
      email: values.email.trim() || null,
      phone: values.phone.trim() || null,
      shipping_address: isAddressFilled(values.shippingAddress) ? values.shippingAddress : null,
      billing_address: values.useDifferentBilling ? values.billingAddress : null,
    };
  }

  const onSubmit = (values: CustomerFormValues) => {
    const payload = buildPayload(values);
    if (customer) {
      updateMutation.mutate({ id: customer._id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-xl">
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[80vh] space-y-5 overflow-y-auto pr-1">
          <ModalHeader>
            <ModalTitle>{customer ? "Edit customer" : "New customer"}</ModalTitle>
            <ModalDescription>
              {customer ? "Update this customer's details." : "Add a new customer record."}
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <FormField label="Name" required error={errors.name?.message}>
              <Input {...register("name")} placeholder="e.g. Wesley England" autoFocus />
            </FormField>

            <FormField
              label="Business"
              hint="Reps of one business are separate customers and may share an email."
              error={errors.businessName?.message}
            >
              <Controller
                control={control}
                name="businessName"
                render={({ field }) => (
                  <Combobox
                    options={businessNames}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="No business"
                    searchPlaceholder="Search or add a business…"
                    allowCustom
                    clearLabel="No business"
                  />
                )}
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Email">
                <Input type="email" {...register("email")} placeholder="customer@example.com" />
              </FormField>
              <FormField label="Phone" error={errors.phone?.message}>
                <Input {...register("phone")} placeholder="0412 345 678" />
              </FormField>
            </div>

            <div className="space-y-4 border-t border-dashed border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-fg/45">Shipping address</p>
              <Controller
                control={control}
                name="shippingAddress"
                render={({ field }) => (
                  <AddressFields
                    value={field.value}
                    onChange={field.onChange}
                    errors={{
                      address: errors.shippingAddress?.address?.message,
                      suburb: errors.shippingAddress?.suburb?.message,
                      state: errors.shippingAddress?.state?.message,
                      postcode: errors.shippingAddress?.postcode?.message,
                    }}
                    required={false}
                  />
                )}
              />

              <Controller
                control={control}
                name="useDifferentBilling"
                render={({ field }) => (
                  <Checkbox
                    label="Use a different billing address"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                  />
                )}
              />

              {useDifferentBilling && (
                <Controller
                  control={control}
                  name="billingAddress"
                  render={({ field }) => (
                    <AddressFields
                      value={field.value}
                      onChange={field.onChange}
                      errors={{
                        address: errors.billingAddress?.address?.message,
                        suburb: errors.billingAddress?.suburb?.message,
                        state: errors.billingAddress?.state?.message,
                        postcode: errors.billingAddress?.postcode?.message,
                      }}
                      required={false}
                    />
                  )}
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
            <Button type="submit" variant="primary" size="md" className="flex-1" disabled={isSaving || isSubmitting}>
              {isSaving ? "Saving…" : customer ? "Save changes" : "Create customer"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
