import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User, Mail, Phone, MapPin, ShoppingBag } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { FormField } from "@/components/ui/FormField";
import { NativeSelect } from "@/components/ui/Select";
import { CartItemRow } from "@/components/pos/CartItemRow";
import { useCart } from "@/context/cart";
import { useToast } from "@/context";
import { createManualOrder } from "@/lib/api/orders";
import type { CreateManualOrderItemPayload } from "@/lib/api/orders";
import { formatCurrency, formatInvoiceNumber } from "@/utils/format";
import { getTenantSettings } from "@/lib/api/tenantSettings";
import { ORDER_PAYMENT_CHOICE_LABEL } from "@/config/paymentMethods";
import type { CustomerDeliveryState } from "@/components/pos/steps/CustomerDeliveryStep";
import type { StepHandle } from "@/components/pos/steps/StepHandle";
import type { Order } from "@/types/orders";
import type { OrderPaymentChoice } from "@/types/payment";
import { paymentChoiceSchema } from "@/lib/validation/reviewOrder";

interface ReviewOrderStepProps {
  customerDelivery: CustomerDeliveryState;
  orderNote: string;
  onOrderNoteChange: (note: string) => void;
  discounts: Record<string, string>;
  onDiscountsChange: (discounts: Record<string, string>) => void;
  paymentChoice: OrderPaymentChoice | "";
  onPaymentChoiceChange: (choice: OrderPaymentChoice | "") => void;
  amountPaidInput: string;
  onAmountPaidInputChange: (value: string) => void;
  onOrderCreated: (order: Order) => void;
  // Bubbles the create-order mutation's pending state up to the page header,
  // which owns the Create button now (and needs to show "Creating…"/disable it).
  onPendingChange?: (pending: boolean) => void;
}

export const ReviewOrderStep = forwardRef<StepHandle, ReviewOrderStepProps>(function ReviewOrderStep(
  {
    customerDelivery,
    orderNote,
    onOrderNoteChange,
    discounts,
    onDiscountsChange,
    paymentChoice,
    onPaymentChoiceChange,
    amountPaidInput,
    onAmountPaidInputChange,
    onOrderCreated,
    onPendingChange,
  },
  ref,
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { items, clearCart } = useCart();
  const { customer, deliveryMethod, shippingAddress, useDifferentBilling, billingAddress } = customerDelivery;

  const { data: tenantSettingsData } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: getTenantSettings,
  });
  const pickupLocation = tenantSettingsData?.data?.pickup_location;

  const [paymentMethodError, setPaymentMethodError] = useState<string | undefined>();

  const lines = useMemo(
    () =>
      items.map((item) => {
        const lineSubtotal = item.unit_price * item.quantity;
        const rawDiscount = Number(discounts[item.key]) || 0;
        const discount = Math.min(Math.max(rawDiscount, 0), lineSubtotal);
        return { item, lineSubtotal, discount, lineTotal: lineSubtotal - discount };
      }),
    [items, discounts],
  );

  const rawSubtotal = lines.reduce((sum, l) => sum + l.lineSubtotal, 0);
  const totalDiscount = lines.reduce((sum, l) => sum + l.discount, 0);
  // Nothing to ship for pickup — matches order.service.js#createManualOrder,
  // which only charges freight when delivery_method is "delivery".
  const shippingTotal =
    deliveryMethod === "delivery" ? items.reduce((sum, i) => sum + i.shipping_cost * i.quantity, 0) : 0;
  const total = rawSubtotal - totalDiscount + shippingTotal;
  const isPaymentLink = paymentChoice === "payment_link";
  const amountPaid = isPaymentLink ? 0 : Math.min(Math.max(Number(amountPaidInput) || 0, 0), total);
  const amountDue = total - amountPaid;

  const createMutation = useMutation({
    mutationFn: createManualOrder,
    onSuccess: (res) => {
      toast({
        title: "Order created",
        description: `Invoice ${formatInvoiceNumber(res.data.invoice_number_prefix, res.data.invoice_number)} generated.`,
        tone: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      clearCart();
      onOrderCreated(res.data);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't create order", description: err.message, tone: "danger" });
    },
  });

  function handleSubmit() {
    if (!customer) return;
    const paymentCheck = paymentChoiceSchema.safeParse(paymentChoice);
    if (!paymentCheck.success) {
      setPaymentMethodError(paymentCheck.error.issues[0]?.message ?? "Select how this order will be settled");
      toast({ title: "Missing payment method", description: "Choose how this order will be paid.", tone: "danger" });
      return;
    }
    setPaymentMethodError(undefined);

    const payloadItems: CreateManualOrderItemPayload[] = lines.map(({ item, discount }) => ({
      product: item.product_id,
      variant: item.variant_id,
      quantity: item.quantity,
      discount_amount: discount,
      note: item.note,
    }));

    createMutation.mutate({
      customer_id: customer._id,
      items: payloadItems,
      delivery_method: deliveryMethod,
      shipping_address: deliveryMethod === "delivery" ? shippingAddress : undefined,
      // Joi's `forbidden()` for pickup orders rejects an explicit `null`,
      // not just a truthy value — must be omitted entirely, not nulled.
      billing_address: deliveryMethod === "delivery" && useDifferentBilling ? billingAddress : undefined,
      note: orderNote.trim() || null,
      payment_method: paymentCheck.data,
      amount_paid: amountPaid || undefined,
    });
  }

  useImperativeHandle(ref, () => ({ submit: handleSubmit }));

  useEffect(() => {
    onPendingChange?.(createMutation.isPending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createMutation.isPending]);

  if (!customer) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Product List" description={`${items.length} line${items.length !== 1 ? "s" : ""}`} />
            <div className="divide-y divide-border">
              {lines.map(({ item, lineTotal }) => (
                <CartItemRow
                  key={item.key}
                  item={item}
                  discountValue={discounts[item.key] ?? ""}
                  onDiscountChange={(value) => onDiscountsChange({ ...discounts, [item.key]: value })}
                  lineTotal={lineTotal}
                />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Customer Note" description="Visible to the customer on their invoice" />
            <CardContent>
              <Textarea
                value={orderNote}
                onChange={(e) => onOrderNoteChange(e.target.value)}
                placeholder="Add a note for this order…"
                size="sm"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Payment" />
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between text-fg/60">
                <span>Subtotal</span>
                <span>{formatCurrency(rawSubtotal)}</span>
              </div>
              <div className="flex justify-between text-fg/60">
                <span>Discount</span>
                <span>{totalDiscount > 0 ? `-${formatCurrency(totalDiscount)}` : formatCurrency(0)}</span>
              </div>
              <div className="flex justify-between text-fg/60">
                <span>Shipping</span>
                <span>{formatCurrency(shippingTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-fg">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-fg/60">Payment Method</span>
                <FormField error={paymentMethodError} className="w-48">
                  <NativeSelect
                    value={paymentChoice}
                    onChange={(e) => {
                      onPaymentChoiceChange(e.target.value as OrderPaymentChoice | "");
                      setPaymentMethodError(undefined);
                    }}
                  >
                    <option value="">Select method…</option>
                    {(Object.entries(ORDER_PAYMENT_CHOICE_LABEL) as [OrderPaymentChoice, string][]).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </NativeSelect>
                </FormField>
              </div>

              {isPaymentLink ? (
                <p className="text-xs text-fg/50">
                  Nothing is collected now — a Stripe payment link is generated on the next step for the customer to
                  pay online.
                </p>
              ) : (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-fg/60">Amount Paid</span>
                  <Input
                    type="number"
                    min={0}
                    max={total}
                    step="0.01"
                    value={amountPaidInput}
                    onChange={(e) => onAmountPaidInputChange(e.target.value)}
                    placeholder="0.00"
                    size="sm"
                    className="w-28 text-right"
                  />
                </div>
              )}

              <div className="flex justify-between text-base font-semibold text-danger">
                <span>Balance Due</span>
                <span>{formatCurrency(amountDue)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Customer" />
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-fg">
                <User className="h-4 w-4 text-fg/40" />
                {customer.name}
              </div>
              <div className="flex items-center gap-2 text-fg/60">
                <ShoppingBag className="h-4 w-4 text-fg/40" />
                {customer.orders_count ?? 0} orders
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Contact Information" />
            <CardContent className="space-y-2 text-sm">
              {customer.email && (
                <div className="flex items-center gap-2 text-fg/70">
                  <Mail className="h-4 w-4 shrink-0 text-fg/40" />
                  <span className="truncate">{customer.email}</span>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2 text-fg/70">
                  <Phone className="h-4 w-4 shrink-0 text-fg/40" />
                  {customer.phone}
                </div>
              )}
              {!customer.email && !customer.phone && <p className="text-xs text-fg/45">No contact info on file.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title={deliveryMethod === "pickup" ? "Collection" : "Delivery"} />
            <CardContent className="space-y-1 text-sm">
              {deliveryMethod === "pickup" ? (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-fg/40" />
                  <div>
                    <div className="text-fg">{pickupLocation?.address || "—"}</div>
                    <p className="mt-1 text-xs text-fg/50">Customer will collect from this location.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-fg/40" />
                  <div className="text-fg">
                    {shippingAddress.address}, {shippingAddress.suburb} {shippingAddress.state}{" "}
                    {shippingAddress.postcode}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
});
