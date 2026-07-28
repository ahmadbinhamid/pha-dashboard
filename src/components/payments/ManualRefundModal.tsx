import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { NativeSelect } from "@/components/ui/Select";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/Modal";
import { useToast } from "@/context";
import { refundPaymentManual } from "@/lib/api/payments";
import { formatCurrencyFromCents } from "@/utils/format";
import { MANUAL_REFUND_REASONS } from "@/config/refundReasons";
import type { Payment, RefundReason } from "@/types/payment";

interface ManualRefundModalProps {
  payment: Payment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Refund entry for a payment collected outside Stripe (cash, online
// transfer, EFPOS) — there's no gateway to reverse, so staff just record the
// amount they handed back and why; it's saved straight to the DB and shown
// in the refund history alongside any Stripe refunds.
export function ManualRefundModal({ payment, open, onOpenChange, onSuccess }: ManualRefundModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const remainingCents = payment.amount - payment.amount_refunded;
  const remainingDollars = remainingCents / 100;

  const [amountInput, setAmountInput] = useState(remainingDollars.toFixed(2));
  const [reason, setReason] = useState<RefundReason>("customer_request");
  const [error, setError] = useState<string | undefined>();

  const amountCents = Math.round(Number(amountInput) * 100);

  const mutation = useMutation({
    mutationFn: () => refundPaymentManual(payment._id, { amount: amountCents, reason }),
    onSuccess: () => {
      toast({ title: "Refund recorded", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["payment", payment._id] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      reset();
      onSuccess();
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't record refund", description: err.message, tone: "danger" });
    },
  });

  function reset() {
    setAmountInput(remainingDollars.toFixed(2));
    setReason("customer_request");
    setError(undefined);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isInteger(amountCents) || amountCents < 1 || amountCents > remainingCents) {
      setError(`Amount must be between $0.01 and ${formatCurrencyFromCents(remainingCents)}`);
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <ModalContent>
        <form onSubmit={handleSubmit}>
          <ModalHeader>
            <ModalTitle>Record Manual Refund</ModalTitle>
            <ModalDescription>
              This payment was collected outside Stripe, so no money moves automatically — record the amount you
              handed back. Available to refund: {formatCurrencyFromCents(remainingCents)}.
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <FormField label="Refund Amount" required error={error}>
              <Input
                type="number"
                min="0.01"
                max={remainingDollars}
                step="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </FormField>
            <FormField label="Reason" required>
              <NativeSelect value={reason} onChange={(e) => setReason(e.target.value as RefundReason)}>
                {MANUAL_REFUND_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
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
            <Button type="submit" variant="danger" size="md" className="flex-1 gap-2" disabled={mutation.isPending}>
              <RotateCcw className="h-4 w-4" />
              {mutation.isPending ? "Saving…" : "Record Refund"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
