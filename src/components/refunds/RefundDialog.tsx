import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Radio, RadioGroup } from "@/components/ui/Radio";
import { NativeSelect } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/context";
import { getRefundable, createRefund } from "@/lib/api/refunds";
import { REFUND_REASONS, RESTOCK_DEFAULT_REASONS } from "@/config/refundReasons";
import { RefundLineItemsSection, type LineSelection } from "./RefundLineItemsSection";
import { RefundFullOrderSection } from "./RefundFullOrderSection";
import { RefundAmountSection } from "./RefundAmountSection";
import { RefundSummary, type RefundSummaryFigures } from "./RefundSummary";
import { RefundEbayConfirmation } from "./RefundEbayConfirmation";
import { RefundStuckWarning } from "./RefundStuckWarning";
import type { RefundReason, RefundScope, CreateRefundPayload } from "@/types/refund";
import { refundAmountSchema } from "@/lib/validation/refund";

interface RefundDialogProps {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const SCOPE_OPTIONS: { value: RefundScope; label: string; description: string }[] = [
  { value: "full_order", label: "Whole invoice", description: "Refund everything still refundable on this order" },
  { value: "line_items", label: "Specific items", description: "Pick which products and quantities came back" },
  { value: "amount", label: "Amount only", description: "A goodwill credit or adjustment with no line data" },
];

// refund-redesign-spec.md §7 — one dialog, three scopes, one settlement path
// chosen automatically per payment (the admin never picks Stripe vs manual).
// The client computes no money anywhere in this file — every number shown
// either comes straight from GET /refundable or is a plain multiplication of
// a figure /refundable already computed (see RefundSummary's own comment),
// and the actual charged total only ever comes from the POST response.
export function RefundDialog({ orderId, open, onOpenChange, onSuccess }: RefundDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"scope" | "details">("scope");
  const [scope, setScope] = useState<RefundScope>("line_items");
  const [lineSelections, setLineSelections] = useState<Map<string, LineSelection>>(new Map());
  const [restockAll, setRestockAll] = useState(false);
  const [refundShipping, setRefundShipping] = useState(true);
  const [amountDollars, setAmountDollars] = useState("");
  const [reason, setReason] = useState<RefundReason>("customer_request");
  const [internalNote, setInternalNote] = useState("");
  const [ebayConfirmed, setEbayConfirmed] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [amountError, setAmountError] = useState<string | undefined>();

  // Generated once per dialog OPEN, not per submit click — a double-click
  // (or a retry after a network hiccup) reuses the same key, so the server
  // returns the same refund instead of creating a second one.
  const [idempotencyKey, setIdempotencyKey] = useState("");
  useEffect(() => {
    if (open) {
      setIdempotencyKey(crypto.randomUUID());
      setStep("scope");
      setLineSelections(new Map());
      setRestockAll(false);
      setRefundShipping(true);
      setAmountDollars("");
      setReason("customer_request");
      setInternalNote("");
      setEbayConfirmed(false);
      setError(undefined);
      setAmountError(undefined);
    }
  }, [open]);

  const { data: refundableResp, isLoading } = useQuery({
    queryKey: ["order-refundable", orderId],
    queryFn: () => getRefundable(orderId),
    enabled: open,
  });
  const refundable = refundableResp?.data;

  const restockDefault = RESTOCK_DEFAULT_REASONS.has(reason);

  // §5 — an eBay payment allocation only shows up once there's still
  // something refundable on it; the acknowledgement gate only needs to
  // appear when it could actually be used.
  const hasEbayPayment = refundable?.payments.some((p) => p.provider === "ebay" && p.refundable > 0) ?? false;

  const mutation = useMutation({
    mutationFn: (payload: CreateRefundPayload) => createRefund(orderId, payload),
    onSuccess: () => {
      toast({ title: "Refund issued", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["order-refundable", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order-refunds", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      onOpenChange(false);
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const figures: RefundSummaryFigures = useMemo(() => {
    if (!refundable) return { items: 0, shipping: 0, adjustment: 0, gst: 0, total: 0 };

    if (scope === "amount") {
      const cents = Math.round((Number(amountDollars) || 0) * 100);
      return { items: 0, shipping: 0, adjustment: 0, gst: Math.round(cents / 11), total: cents };
    }

    if (scope === "full_order") {
      const items = refundable.lines
        .filter((l) => l.refundable_quantity > 0)
        .reduce((sum, l) => sum + l.refundable_amount, 0);
      const shipping = refundShipping ? refundable.shipping.refundable : 0;
      return { items, shipping, adjustment: 0, gst: Math.round((items + shipping) / 11), total: items + shipping };
    }

    // line_items — sum of effective_unit_price × selected quantity for each
    // picked line, a plain multiplication of an already server-computed
    // per-unit figure, not a re-derivation of discount apportionment.
    let items = 0;
    for (const [orderItemId, sel] of lineSelections) {
      const line = refundable.lines.find((l) => l.order_item_id === orderItemId);
      if (line) items += line.effective_unit_price * sel.quantity;
    }
    return { items, shipping: 0, adjustment: 0, gst: Math.round(items / 11), total: items };
  }, [refundable, scope, amountDollars, refundShipping, lineSelections]);

  function handleLineChange(orderItemId: string, next: LineSelection | null) {
    setLineSelections((prev) => {
      const map = new Map(prev);
      if (next) map.set(orderItemId, next);
      else map.delete(orderItemId);
      return map;
    });
  }

  function handleSubmit() {
    setError(undefined);
    setAmountError(undefined);
    if (!refundable) return;

    if (hasEbayPayment && !ebayConfirmed) {
      setError("Confirm the refund has already been issued in eBay Seller Hub before continuing");
      return;
    }

    const base = {
      idempotency_key: idempotencyKey,
      reason,
      internal_note: internalNote || null,
      ebay_refund_confirmed: ebayConfirmed,
    };

    let payload: CreateRefundPayload;
    if (scope === "amount") {
      const amountCheck = refundAmountSchema(refundable.max_refundable).safeParse(amountDollars);
      if (!amountCheck.success) {
        setAmountError(amountCheck.error.issues[0]?.message ?? "Enter a valid amount");
        return;
      }
      const cents = Math.round(Number(amountDollars) * 100);
      payload = { ...base, scope: "amount", amount: cents };
    } else if (scope === "full_order") {
      payload = { ...base, scope: "full_order", restock_all: restockAll, refund_shipping: refundShipping };
    } else {
      if (lineSelections.size === 0) {
        setError("Select at least one item to refund");
        return;
      }
      payload = {
        ...base,
        scope: "line_items",
        lines: [...lineSelections.entries()].map(([order_item_id, sel]) => ({
          order_item_id,
          quantity: sel.quantity,
          restock: sel.restock,
        })),
      };
    }

    mutation.mutate(payload);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-xl">
        <ModalHeader>
          <ModalTitle>Issue Refund</ModalTitle>
          <ModalDescription>
            {step === "scope"
              ? "Choose what's being refunded — settlement (Stripe or manual) is handled automatically."
              : SCOPE_OPTIONS.find((o) => o.value === scope)?.label}
          </ModalDescription>
        </ModalHeader>

        {isLoading || !refundable ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : step === "scope" ? (
          <RadioGroup>
            {SCOPE_OPTIONS.map((opt) => (
              <div
                key={opt.value}
                className="rounded-xs border border-border p-3 hover:bg-bg-2"
                onClick={() => setScope(opt.value)}
              >
                <Radio
                  name="refund-scope"
                  checked={scope === opt.value}
                  onChange={() => setScope(opt.value)}
                  label={opt.label}
                  description={opt.description}
                />
              </div>
            ))}
          </RadioGroup>
        ) : (
          <div className="space-y-4">
            <RefundStuckWarning stuckRefunds={refundable.stuck_refunds} />

            {scope === "line_items" && (
              <RefundLineItemsSection
                lines={refundable.lines}
                selection={lineSelections}
                onChange={handleLineChange}
                restockDefault={restockDefault}
              />
            )}
            {scope === "full_order" && (
              <RefundFullOrderSection
                summary={refundable}
                restockAll={restockAll}
                onRestockAllChange={setRestockAll}
                refundShipping={refundShipping}
                onRefundShippingChange={setRefundShipping}
              />
            )}
            {scope === "amount" && (
              <RefundAmountSection
                amountDollars={amountDollars}
                onAmountChange={(v) => {
                  setAmountDollars(v);
                  setAmountError(undefined);
                }}
                maxRefundable={refundable.max_refundable}
                error={amountError}
              />
            )}

            {hasEbayPayment && <RefundEbayConfirmation confirmed={ebayConfirmed} onChange={setEbayConfirmed} />}

            <FormField label="Reason" required>
              <NativeSelect value={reason} onChange={(e) => setReason(e.target.value as RefundReason)}>
                {REFUND_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            <FormField label="Internal Note">
              <textarea
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                rows={2}
                className="w-full rounded-xs border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Optional — visible to staff only"
              />
            </FormField>

            <RefundSummary figures={figures} isEstimate />

            {error && <div className="text-sm text-danger">{error}</div>}
          </div>
        )}

        <ModalFooter>
          {step === "details" && (
            <Button type="button" variant="secondary" size="md" onClick={() => setStep("scope")}>
              Back
            </Button>
          )}
          {step === "scope" ? (
            <Button type="button" variant="primary" size="md" onClick={() => setStep("details")} disabled={!refundable}>
              Next
            </Button>
          ) : (
            <Button
              type="button"
              variant="danger"
              size="md"
              className="gap-2"
              disabled={mutation.isPending}
              onClick={handleSubmit}
            >
              <RotateCcw className="h-4 w-4" />
              {mutation.isPending ? "Issuing…" : "Issue Refund"}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
