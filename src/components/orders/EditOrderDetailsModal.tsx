import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/Modal";
import { AddressFields } from "@/components/pos/AddressFields";
import { useToast } from "@/context";
import { updateOrderCustomerDetails } from "@/lib/api/orders";
import type { OrderDetail } from "@/types/orders";
import { editOrderDetailsFormSchema, type EditOrderDetailsFormValues } from "@/lib/validation/editOrderDetails";
import { EMPTY_ADDRESS } from "@/lib/validation/address";

interface EditOrderDetailsModalProps {
  order: OrderDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function orderToForm(order: OrderDetail): EditOrderDetailsFormValues {
  return {
    name: order.customer.name,
    email: order.customer.email ?? "",
    phone: order.customer.phone ?? "",
    shippingAddress: order.shipping_address ?? EMPTY_ADDRESS,
    useDifferentBilling: !!order.billing_address,
    billingAddress: order.billing_address ?? EMPTY_ADDRESS,
  };
}

// Edits the order's OWN customer/address snapshot — deliberately never the
// linked Customer profile (if any), same separation the backend already
// keeps (see order.service.js#updateOrderCustomerDetails).
export function EditOrderDetailsModal({ order, open, onOpenChange }: EditOrderDetailsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isPickup = order.delivery_method === "pickup";

  const schema = useMemo(() => editOrderDetailsFormSchema(isPickup), [isPickup]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EditOrderDetailsFormValues>({
    resolver: zodResolver(schema),
    defaultValues: orderToForm(order),
  });

  const useDifferentBilling = watch("useDifferentBilling");

  // Re-sync from the order every time the modal opens — not on every order
  // change, since a background refetch mid-edit shouldn't clobber in-progress input.
  useEffect(() => {
    if (open) reset(orderToForm(order));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: (values: EditOrderDetailsFormValues) =>
      updateOrderCustomerDetails(order._id, {
        customer: {
          name: values.name.trim(),
          email: values.email.trim() || null,
          phone: values.phone.trim() || null,
        },
        ...(isPickup
          ? {}
          : {
              shipping_address: values.shippingAddress,
              billing_address: values.useDifferentBilling ? values.billingAddress : null,
            }),
      }),
    onSuccess: () => {
      toast({ title: "Order updated", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["order", order._id] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't update order", description: err.message, tone: "danger" });
    },
  });

  const onSubmit = (values: EditOrderDetailsFormValues) => mutation.mutate(values);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-xl">
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[80vh] space-y-5 overflow-y-auto pr-1">
          <ModalHeader>
            <ModalTitle>Edit Order Details</ModalTitle>
            <ModalDescription>
              Corrects this order&apos;s own customer and address details — it never changes the linked customer
              profile.
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <FormField label="Name" required error={errors.name?.message}>
              <Input {...register("name")} placeholder="Customer name" />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Email" error={errors.email?.message}>
                <Input type="email" {...register("email")} placeholder="name@example.com" />
              </FormField>
              <FormField label="Phone">
                <Input {...register("phone")} placeholder="04xx xxx xxx" />
              </FormField>
            </div>

            {!isPickup && (
              <>
                <div className="border-t border-border pt-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg/45">Shipping Address</p>
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
                      />
                    )}
                  />
                </div>

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
                      />
                    )}
                  />
                )}
              </>
            )}
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="flex-1"
              disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="flex-1"
              disabled={mutation.isPending || isSubmitting}
            >
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
