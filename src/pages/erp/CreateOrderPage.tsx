import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { OrderStepper } from "@/components/pos/OrderStepper";
import { OrderSummaryPanel } from "@/components/pos/OrderSummaryPanel";
import { AddProductsStep } from "@/components/pos/steps/AddProductsStep";
import { CustomerDeliveryStep } from "@/components/pos/steps/CustomerDeliveryStep";
import type { CustomerDeliveryState } from "@/components/pos/steps/CustomerDeliveryStep";
import { ReviewOrderStep } from "@/components/pos/steps/ReviewOrderStep";
import { OrderConfirmationStep } from "@/components/pos/steps/OrderConfirmationStep";
import type { StepHandle } from "@/components/pos/steps/StepHandle";
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

// What the header says beneath the title, so the operator is told what this
// screen wants from them rather than what the page is called.
const STEP_DESCRIPTION: Record<number, string> = {
  1: "Search the catalogue and build the order's lines.",
  2: "Choose who this order is for and how it reaches them.",
  3: "Check the lines, apply discounts and take payment.",
  4: "Order created — print, email or start another.",
};

// Steps 1 and 2 run beside the live order summary; 3 and 4 own the full width
// (Review has its own totals column, Confirmation is a receipt).
const SUMMARY_STEPS = new Set([1, 2]);

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
  shippingCostInput: string;
}

const EMPTY_WIZARD: WizardStorage = {
  step: 1,
  customerDelivery: EMPTY_CUSTOMER_DELIVERY,
  orderNote: "",
  discounts: {},
  paymentChoice: "",
  amountPaidInput: "",
  shippingCostInput: "",
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
  const [shippingCostInput, setShippingCostInput] = useState(initial.shippingCostInput);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [reviewPending, setReviewPending] = useState(false);

  const customerDeliveryRef = useRef<StepHandle>(null);
  const reviewOrderRef = useRef<StepHandle>(null);

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
    persistWizard({ step, customerDelivery, orderNote, discounts, paymentChoice, amountPaidInput, shippingCostInput });
  }, [step, customerDelivery, orderNote, discounts, paymentChoice, amountPaidInput, shippingCostInput]);

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
    setShippingCostInput("");
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

  function handleBack() {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }

  function handleNext() {
    if (step === 1) goToStep2();
    else if (step === 2) customerDeliveryRef.current?.submit();
    else if (step === 3) reviewOrderRef.current?.submit();
  }

  const nextDisabled = step === 1 ? items.length === 0 : step === 3 ? reviewPending : false;

  const showSummary = SUMMARY_STEPS.has(step);

  return (
    <div className="space-y-6">
      {/* Title, actions and the step rail travel together as one sticky block.
          The negative margins cancel AppShell's page gutter so the opaque
          background reaches the edges instead of letting cards show through
          beside it — same pattern as SettingsPage, and matching the shell's
          own px-4 / sm:px-6 / lg:px-10 rather than a single hardcoded -mx-6. */}
      <div className="sticky top-0 z-30 -mx-4 space-y-4 border-b border-border bg-bg/95 px-4 pb-4 pt-section backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <PageHeader title="Create Order" description={STEP_DESCRIPTION[step]}>
          {step < 4 && (
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
          )}
          {step > 1 && step < 4 && (
            <Button variant="secondary" size="sm" onClick={handleBack} disabled={reviewPending}>
              Back
            </Button>
          )}
          {step < 4 && (
            <Button variant="primary" size="sm" onClick={handleNext} disabled={nextDisabled}>
              {step === 3 ? (reviewPending ? "Creating…" : "Create Order") : "Next"}
            </Button>
          )}
        </PageHeader>

        <Card className="px-5 py-3.5">
          <OrderStepper steps={STEPS} current={step} />
        </Card>
      </div>

      {showSummary ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            {step === 1 && <AddProductsStep />}
            {step === 2 && (
              <CustomerDeliveryStep
                ref={customerDeliveryRef}
                state={customerDelivery}
                onChange={patchCustomerDelivery}
                onContinue={() => setStep(3)}
              />
            )}
          </div>

          {/* Sticky under the header block, so the total stays visible while
              the product list scrolls. */}
          <div className="lg:sticky lg:top-44 lg:self-start">
            <OrderSummaryPanel />
          </div>
        </div>
      ) : null}

      {step === 3 && (
        <ReviewOrderStep
          ref={reviewOrderRef}
          customerDelivery={customerDelivery}
          orderNote={orderNote}
          onOrderNoteChange={setOrderNote}
          discounts={discounts}
          onDiscountsChange={setDiscounts}
          paymentChoice={paymentChoice}
          onPaymentChoiceChange={setPaymentChoice}
          amountPaidInput={amountPaidInput}
          onAmountPaidInputChange={setAmountPaidInput}
          shippingCostInput={shippingCostInput}
          onShippingCostInputChange={setShippingCostInput}
          onOrderCreated={handleOrderCreated}
          onPendingChange={setReviewPending}
        />
      )}

      {step === 4 && createdOrder && (
        <OrderConfirmationStep order={createdOrder} paymentMethod={paymentChoice} onStartNewOrder={startNewOrder} />
      )}
    </div>
  );
}
