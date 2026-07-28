import { forwardRef, useImperativeHandle, useState } from "react";
import { UserCheck, X, Store, Truck } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Checkbox } from "@/components/ui/Checkbox";
import { CustomerSearchCombobox } from "@/components/pos/CustomerSearchCombobox";
import { AddressFields } from "@/components/pos/AddressFields";
import { CustomerFormModal } from "@/components/customers/CustomerFormModal";
import { useToast } from "@/context";
import { cn } from "@/utils/cn";
import type { StepHandle } from "@/components/pos/steps/StepHandle";
import type { Customer } from "@/types/customer";
import type { OrderAddress, OrderDeliveryMethod } from "@/types/orders";

const EMPTY_ADDRESS: OrderAddress = { address: "", suburb: "", state: "", postcode: "" };

interface FulfilmentOptionProps {
  icon: React.ElementType;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}

// Card-style option instead of a bare native radio input — same selectable-
// card pattern as the rest of the app's "pick one of a few things" moments.
function FulfilmentOption({ icon: Icon, label, description, selected, onSelect }: FulfilmentOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-1 items-start gap-3 rounded-md border p-4 text-left transition",
        "outline-none! focus-visible:ring-2 focus-visible:ring-accent/45",
        selected ? "border-accent bg-accent/5" : "border-border bg-card hover:border-fg/20 hover:bg-bg-2/40",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
          selected ? "bg-accent/15 text-accent" : "bg-bg-2 text-fg/50",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-fg">{label}</span>
          <span
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
              selected ? "border-accent" : "border-border",
            )}
          >
            {selected && <span className="h-2 w-2 rounded-full bg-accent" />}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-fg/55">{description}</span>
      </span>
    </button>
  );
}

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
  onContinue: () => void;
}

// Combines what were two separate steps (customer, and pickup/delivery mode)
// into one — the two are always decided together for a manual sale. Back
// needs no validation so the page header handles it directly; Continue does,
// so it's exposed via ref for the header's Next button to trigger.
export const CustomerDeliveryStep = forwardRef<StepHandle, CustomerDeliveryStepProps>(function CustomerDeliveryStep(
  { state, onChange, onContinue },
  ref,
) {
  const { toast } = useToast();
  const { customer, deliveryMethod, shippingAddress, useDifferentBilling, billingAddress } = state;

  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [prefillName, setPrefillName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function openCreateNew(searchText: string) {
    setPrefillName(searchText);
    setCustomerFormOpen(true);
  }

  // Selecting (or just creating) a customer with a saved address carries it
  // over as a starting point — staff can still edit it per-order without
  // touching the customer's profile.
  function selectCustomer(c: Customer) {
    onChange({
      customer: c,
      shippingAddress: c.shipping_address ?? EMPTY_ADDRESS,
      useDifferentBilling: !!c.billing_address,
      billingAddress: c.billing_address ?? EMPTY_ADDRESS,
    });
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

  useImperativeHandle(ref, () => ({ submit: handleContinue }));

  return (
    <div className="space-y-5">
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
                  onSelect={selectCustomer}
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
          <div className="grid gap-3 sm:grid-cols-2">
            <FulfilmentOption
              icon={Store}
              label="Pickup"
              description="Customer will collect this order in-store."
              selected={deliveryMethod === "pickup"}
              onSelect={() => onChange({ deliveryMethod: "pickup" })}
            />
            <FulfilmentOption
              icon={Truck}
              label="Delivery"
              description="Ship this order to the customer's address."
              selected={deliveryMethod === "delivery"}
              onSelect={() => onChange({ deliveryMethod: "delivery" })}
            />
          </div>

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

      <CustomerFormModal
        open={customerFormOpen}
        onOpenChange={setCustomerFormOpen}
        customer={null}
        initialName={prefillName}
        onCreated={selectCustomer}
      />
    </div>
  );
});
