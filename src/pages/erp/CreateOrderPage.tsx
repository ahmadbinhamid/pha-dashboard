import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { OrderStepper } from "@/components/pos/OrderStepper";
import { AddProductsStep } from "@/components/pos/steps/AddProductsStep";
import { CustomerDeliveryStep } from "@/components/pos/steps/CustomerDeliveryStep";
import type { CustomerDeliveryState } from "@/components/pos/steps/CustomerDeliveryStep";
import { ReviewOrderStep } from "@/components/pos/steps/ReviewOrderStep";
import { OrderConfirmationStep } from "@/components/pos/steps/OrderConfirmationStep";
import { useCart } from "@/context/cart";
import { ORDER_DRAFT_STORAGE_KEY, clearOrderDraft } from "@/lib/orderDraftStorage";
import type { Order, OrderAddress } from "@/types/orders";
import type { OrderPaymentChoice } from "@/types/payment";

const STEPS = [
  { label: "Add Products" },
  { label: "Customer & Delivery" },
  { label: "Review Order" },
  { label: "Order Confirmation" },
];

const EMPTY_ADDRESS: OrderAddress = { address: "", suburb: "", state: "", postcode: "" };

const EMPTY_CUSTOMER_DELIVERY: CustomerDeliveryState = {
  customer: null,
  deliveryMethod: "pickup",
  shippingAddress: EMPTY_ADDRESS,
  useDifferentBilling: false,
  billingAddress: EMPTY_ADDRESS,
};

// Everything the wizard needs to resume mid-flow after a full page reload —
// e.g. Vite's dev-server HMR client force-reloads the page if its WebSocket
// dropped while the tab was backgrounded, which would otherwise wipe every
// in-memory useState the instant the window loses and regains focus.
interface WizardStorage {
  step: number;
  customerDelivery: CustomerDeliveryState;
  orderNote: string;
  discounts: Record<string, string>;
  paymentChoice: OrderPaymentChoice | "";
  amountPaidInput: string;
}

const EMPTY_WIZARD: WizardStorage = {
  step: 1,
  customerDelivery: EMPTY_CUSTOMER_DELIVERY,
  orderNote: "",
  discounts: {},
  paymentChoice: "",
  amountPaidInput: "",
};

function readStoredWizard(): WizardStorage {
  try {
    const raw = localStorage.getItem(ORDER_DRAFT_STORAGE_KEY);
    if (!raw) return EMPTY_WIZARD;
    const parsed = JSON.parse(raw) as Partial<WizardStorage>;
    const merged = { ...EMPTY_WIZARD, ...parsed };
    // Step 4 (confirmation) is never persisted with its `createdOrder` — that
    // lives only in in-memory state — so resuming into it renders a blank
    // confirmation screen. Treat a stored step 4 as stale and start over.
    if (merged.step >= 4) return EMPTY_WIZARD;
    return merged;
  } catch {
    return EMPTY_WIZARD;
  }
}

function persistWizard(state: WizardStorage) {
  try {
    localStorage.setItem(ORDER_DRAFT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* localStorage unavailable (private mode / quota) — wizard still works for this tab */
  }
}

export default function CreateOrderPage() {
  const navigate = useNavigate();
  const { items, clearCart } = useCart();

  const initial = readStoredWizard();
  const [step, setStep] = useState(initial.step);
  const [customerDelivery, setCustomerDelivery] = useState<CustomerDeliveryState>(initial.customerDelivery);
  const [orderNote, setOrderNote] = useState(initial.orderNote);
  const [discounts, setDiscounts] = useState<Record<string, string>>(initial.discounts);
  const [paymentChoice, setPaymentChoice] = useState<OrderPaymentChoice | "">(initial.paymentChoice);
  const [amountPaidInput, setAmountPaidInput] = useState(initial.amountPaidInput);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  // A restored step 2/3 with an empty cart means the cart was cleared
  // elsewhere (or the order behind it was already completed) — there's
  // nothing left to build, so bounce back to step 1 rather than showing a
  // wizard with no products in it.
  useEffect(() => {
    if (step > 1 && items.length === 0) setStep(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Step 4 has nothing worth resuming (the order's already created) and
    // isn't a valid resume target anyway — see readStoredWizard. Persisting
    // it here would just re-write over the clearOrderDraft() call that
    // handleOrderCreated makes right before this effect re-runs.
    if (step === 4) return;
    persistWizard({ step, customerDelivery, orderNote, discounts, paymentChoice, amountPaidInput });
  }, [step, customerDelivery, orderNote, discounts, paymentChoice, amountPaidInput]);

  function goToStep2() {
    if (items.length === 0) return;
    setStep(2);
  }

  function patchCustomerDelivery(patch: Partial<CustomerDeliveryState>) {
    setCustomerDelivery((prev) => ({ ...prev, ...patch }));
  }

  function handleOrderCreated(order: Order) {
    setCreatedOrder(order);
    setStep(4);
    // The order is done and the cart's already cleared — nothing left worth resuming.
    clearOrderDraft();
  }

  function startNewOrder() {
    setCustomerDelivery(EMPTY_CUSTOMER_DELIVERY);
    setOrderNote("");
    setDiscounts({});
    setPaymentChoice("");
    setAmountPaidInput("");
    setCreatedOrder(null);
    setStep(1);
    clearOrderDraft();
  }

  function handleCancel() {
    if (!window.confirm("Cancel this order? Your cart and progress will be cleared.")) return;
    clearCart();
    clearOrderDraft();
    navigate("/orders");
  }

  return (
    <div className="space-y-6 pb-24">
      <PageHeader title="Create Order" description="Build a manual/in-person sale for a customer">
        {step < 4 && (
          <Button variant="ghost" size="md" onClick={handleCancel}>
            Cancel
          </Button>
        )}
      </PageHeader>

      <div className="rounded-xs border border-border bg-card px-5 py-5 shadow-card">
        <OrderStepper steps={STEPS} current={step} />
      </div>

      {step === 1 && <AddProductsStep onContinue={goToStep2} />}

      {step === 2 && (
        <CustomerDeliveryStep
          state={customerDelivery}
          onChange={patchCustomerDelivery}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <ReviewOrderStep
          customerDelivery={customerDelivery}
          orderNote={orderNote}
          onOrderNoteChange={setOrderNote}
          discounts={discounts}
          onDiscountsChange={setDiscounts}
          paymentChoice={paymentChoice}
          onPaymentChoiceChange={setPaymentChoice}
          amountPaidInput={amountPaidInput}
          onAmountPaidInputChange={setAmountPaidInput}
          onBack={() => setStep(2)}
          onOrderCreated={handleOrderCreated}
        />
      )}

      {step === 4 && createdOrder && (
        <OrderConfirmationStep order={createdOrder} onStartNewOrder={startNewOrder} />
      )}

      {/* A direct visit with an empty cart has nothing to build an order
          from — bounce back to product browsing rather than showing a wizard
          with nothing in it. */}
      {step === 1 && items.length === 0 && (
        <p className="text-center text-sm text-fg/50">
          Your cart is empty.{" "}
          <button type="button" className="font-medium text-accent hover:underline" onClick={() => navigate("/products")}>
            Browse products
          </button>{" "}
          to get started.
        </p>
      )}
    </div>
  );
}
