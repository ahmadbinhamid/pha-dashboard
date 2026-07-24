import { useState } from "react";
import { UserCheck, X } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Radio, RadioGroup } from "@/components/ui/Radio";
import { Checkbox } from "@/components/ui/Checkbox";
import { CustomerSearchCombobox } from "@/components/pos/CustomerSearchCombobox";
import { AddressFields } from "@/components/pos/AddressFields";
import { CustomerFormModal } from "@/components/customers/CustomerFormModal";
import { useToast } from "@/context";
import type { Customer } from "@/types/customer";
import type { OrderAddress, OrderDeliveryMethod } from "@/types/orders";

export interface CustomerDeliveryState {
  customer: Customer | null;
  deliveryMethod: OrderDeliveryMethod;
  shippingAddress: OrderAddress;
  useDifferentBilling: boolean;
  billingAddress: OrderAddress;
}

interface CustomerDeliveryStepProps {
  state: CustomerDeliveryState;
  onChange: (patch: Partial<CustomerDeliveryState>) => void;
  onBack: () => void;
  onContinue: () => void;
}

// Combines what were two separate steps (customer, and pickup/delivery mode)
// into one — the two are always decided together for a manual sale.
export function CustomerDeliveryStep({ state, onChange, onBack, onContinue }: CustomerDeliveryStepProps) {
  const { toast } = useToast();
  const { customer, deliveryMethod, shippingAddress, useDifferentBilling, billingAddress } = state;

  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [prefillName, setPrefillName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function openCreateNew(searchText: string) {
    setPrefillName(searchText);
    setCustomerFormOpen(true);
  }

  function handleContinue() {
    const nextErrors: Record<string, string> = {};
    if (!customer) nextErrors.customer = "Select or create a customer to continue";

    if (deliveryMethod === "delivery") {
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
      toast({ title: "Missing details", description: "Please fill in the required fields.", tone: "danger" });
      return;
    }
    setErrors({});
    onContinue();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card>
        <CardHeader title="Customer" />
        <CardContent className="space-y-3">
          {customer ? (
            <div className="flex items-center justify-between rounded-xs border border-border bg-bg-2/40 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <UserCheck className="h-4 w-4 text-accent" />
                <div>
                  <div className="text-sm font-medium text-fg">{customer.name}</div>
                  <div className="text-xs text-fg/50">
                    {customer.email || "No email"} · {customer.phone || "No phone"}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onChange({ customer: null })}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <>
              <FormField error={errors.customer}>
                <CustomerSearchCombobox
                  value={customer}
                  onSelect={(c) => onChange({ customer: c })}
                  onCreateNew={openCreateNew}
                />
              </FormField>
              <Button type="button" variant="secondary" size="sm" onClick={() => openCreateNew("")}>
                + New customer
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Fulfilment" />
        <CardContent className="space-y-5">
          <RadioGroup>
            <Radio
              name="delivery_method"
              checked={deliveryMethod === "pickup"}
              onChange={() => onChange({ deliveryMethod: "pickup" })}
              label="Pickup"
              description="Customer will collect this order in-store."
            />
            <Radio
              name="delivery_method"
              checked={deliveryMethod === "delivery"}
              onChange={() => onChange({ deliveryMethod: "delivery" })}
              label="Delivery"
              description="Ship this order to the customer's address."
            />
          </RadioGroup>

          {deliveryMethod === "delivery" && (
            <div className="space-y-4 border-t border-border pt-5">
              <AddressFields
                value={shippingAddress}
                onChange={(a) => onChange({ shippingAddress: a })}
                errors={{
                  address: errors.address,
                  suburb: errors.suburb,
                  state: errors.state,
                  postcode: errors.postcode,
                }}
              />

              <Checkbox
                label="Use a different billing address"
                checked={useDifferentBilling}
                onChange={(e) => onChange({ useDifferentBilling: e.target.checked })}
              />

              {useDifferentBilling && (
                <AddressFields
                  value={billingAddress}
                  onChange={(a) => onChange({ billingAddress: a })}
                  errors={{
                    address: errors.billingAddress,
                    suburb: errors.billingSuburb,
                    state: errors.billingState,
                    postcode: errors.billingPostcode,
                  }}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="md" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" size="md" onClick={handleContinue}>
          Continue to Review
        </Button>
      </div>

      <CustomerFormModal
        open={customerFormOpen}
        onOpenChange={setCustomerFormOpen}
        customer={null}
        initialName={prefillName}
        onCreated={(c) => onChange({ customer: c })}
      />
    </div>
  );
}
