import { useEffect, useState } from "react";
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
import type { OrderDetail, OrderAddress } from "@/types/orders";

const EMPTY_ADDRESS: OrderAddress = { address: "", suburb: "", state: "", postcode: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EditOrderDetailsModalProps {
  order: OrderDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Edits the order's OWN customer/address snapshot — deliberately never the
// linked Customer profile (if any), same separation the backend already
// keeps (see order.service.js#updateOrderCustomerDetails).
export function EditOrderDetailsModal({ order, open, onOpenChange }: EditOrderDetailsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isPickup = order.delivery_method === "pickup";

  const [name, setName] = useState(order.customer.name);
  const [email, setEmail] = useState(order.customer.email ?? "");
  const [phone, setPhone] = useState(order.customer.phone ?? "");
  const [shippingAddress, setShippingAddress] = useState<OrderAddress>(order.shipping_address ?? EMPTY_ADDRESS);
  const [useDifferentBilling, setUseDifferentBilling] = useState(!!order.billing_address);
  const [billingAddress, setBillingAddress] = useState<OrderAddress>(order.billing_address ?? EMPTY_ADDRESS);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Re-sync from the order every time the modal opens — not on every order
  // change, since a background refetch mid-edit shouldn't clobber in-progress input.
  useEffect(() => {
    if (!open) return;
    setName(order.customer.name);
    setEmail(order.customer.email ?? "");
    setPhone(order.customer.phone ?? "");
    setShippingAddress(order.shipping_address ?? EMPTY_ADDRESS);
    setUseDifferentBilling(!!order.billing_address);
    setBillingAddress(order.billing_address ?? EMPTY_ADDRESS);
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      updateOrderCustomerDetails(order._id, {
        customer: { name: name.trim(), email: email.trim() || null, phone: phone.trim() || null },
        ...(isPickup
          ? {}
          : {
              shipping_address: shippingAddress,
              billing_address: useDifferentBilling ? billingAddress : null,
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Name is required";
    if (email.trim() && !EMAIL_RE.test(email.trim())) nextErrors.email = "Enter a valid email";

    if (!isPickup) {
      if (!shippingAddress.address.trim()) nextErrors.address = "Address is required";
      if (!shippingAddress.suburb.trim()) nextErrors.suburb = "Suburb is required";
      if (!shippingAddress.state.trim()) nextErrors.state = "State is required";
      if (!shippingAddress.postcode.trim()) nextErrors.postcode = "Postcode is required";
      if (useDifferentBilling) {
        if (!billingAddress.address.trim()) nextErrors.billingAddress = "Billing address is required";
        if (!billingAddress.suburb.trim()) nextErrors.billingSuburb = "Billing suburb is required";
        if (!billingAddress.state.trim()) nextErrors.billingState = "Billing state is required";
        if (!billingAddress.postcode.trim()) nextErrors.billingPostcode = "Billing postcode is required";
      }
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-xl">
        <form onSubmit={handleSubmit} className="max-h-[80vh] space-y-5 overflow-y-auto pr-1">
          <ModalHeader>
            <ModalTitle>Edit Order Details</ModalTitle>
            <ModalDescription>
              Corrects this order&apos;s own customer and address details — it never changes the linked customer
              profile.
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <FormField label="Name" required error={errors.name}>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Email" error={errors.email}>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </FormField>
              <FormField label="Phone">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="04xx xxx xxx" />
              </FormField>
            </div>

            {!isPickup && (
              <>
                <div className="border-t border-border pt-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg/45">Shipping Address</p>
                  <AddressFields
                    value={shippingAddress}
                    onChange={setShippingAddress}
                    errors={{
                      address: errors.address,
                      suburb: errors.suburb,
                      state: errors.state,
                      postcode: errors.postcode,
                    }}
                  />
                </div>

                <Checkbox
                  label="Use a different billing address"
                  checked={useDifferentBilling}
                  onChange={(e) => setUseDifferentBilling(e.target.checked)}
                />

                {useDifferentBilling && (
                  <AddressFields
                    value={billingAddress}
                    onChange={setBillingAddress}
                    errors={{
                      address: errors.billingAddress,
                      suburb: errors.billingSuburb,
                      state: errors.billingState,
                      postcode: errors.billingPostcode,
                    }}
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
            <Button type="submit" variant="primary" size="md" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
