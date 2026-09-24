import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
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
import { StickyPageHeader } from "@/components/shared/StickyPageHeader";

const STEPS = [
  { label: "Add Products" },
  { label: "Customer & Delivery" },
  { label: "Review Order" },
  { label: "Order Confirmation" },
];

// Subtitle per step: what the screen needs from the operator.
const STEP_DESCRIPTION: Record<number, string> = {
  1: "Search the catalogue and build the order's lines.",
  2: "Choose who this order is for and how it reaches them.",
  3: "Check the lines, apply discounts and take payment.",
  4: "Order created — print, email or start another.",
};

// Steps 1-2 sit beside the live summary; 3-4 (review, receipt) are full width.
const SUMMARY_STEPS = new Set([1, 2]);

const EMPTY_ADDRESS: OrderAddress = { address: "", suburb: "", state: "", postcode: "" };

const EMPTY_CUSTOMER_DELIVERY: CustomerDeliveryState = {
  customer: null,
  deliveryMethod: "pickup",
  shippingAddress: EMPTY_ADDRESS,
  useDifferentBilling: false,
  billingAddress: EMPTY_ADDRESS,
};

// Resume state for a full reload (e.g. HMR reconnect), which wipes useState.
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
    // Step 4's createdOrder is memory-only, so a stored step 4 is stale.
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
    /* localStorage unavailable (private mode / quota) — wizard still works f... */
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
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [reviewPending, setReviewPending] = useState(false);

  const customerDeliveryRef = useRef<StepHandle>(null);
  const reviewOrderRef = useRef<StepHandle>(null);

  // Restored step 2/3 with an empty cart (cleared elsewhere): back to step 1.
  useEffect(() => {
    if (step > 1 && items.length === 0) setStep(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Never persist step 4: it would undo handleOrderCreated's clearOrderDraft.
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
    // Order done and cart cleared: nothing left worth resuming.
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
    setCancelConfirmOpen(true);
  }

  function confirmCancel() {
    setCancelConfirmOpen(false);
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
      {/* Title, actions and the step rail stay pinned as one block. */}
      <StickyPageHeader className="space-y-4 border-b border-border bg-bg/95 pb-4 backdrop-blur-sm">
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
      </StickyPageHeader>

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

          {/* Pinned under the header; it now sticks 16px higher (flush top). */}
          <div className="lg:sticky lg:top-40 lg:self-start">
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

      <ConfirmModal
        open={cancelConfirmOpen}
        onOpenChange={setCancelConfirmOpen}
        title="Cancel this order?"
        description="Your cart and progress will be cleared."
        confirmLabel="Cancel Order"
        cancelLabel="Keep Editing"
        tone="danger"
        onConfirm={confirmCancel}
      />
    </div>
  );
}
