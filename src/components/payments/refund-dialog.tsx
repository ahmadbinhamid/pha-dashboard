import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/context";
import { refundPayment } from "@/lib/api/payments";
import { formatCurrencyFromCents } from "@/utils/format";
import type { Payment, RefundReason } from "@/types/payment";
import { REFUND_REASONS } from "@/config/refund-reasons";

interface RefundDialogProps {
  payment: Payment;
  onClose: () => void;
  onSuccess: () => void;
}

export function RefundDialog({ payment, onClose, onSuccess }: RefundDialogProps) {
  const { toast } = useToast();
  const remainingCents = payment.amount - payment.amount_refunded;
  const remainingDollars = remainingCents / 100;

  const [amount, setAmount] = useState(remainingDollars.toFixed(2));
  const [reason, setReason] = useState<RefundReason>("customer_request");
  const [restock, setRestock] = useState(false);

  const amountCents = Math.round(Number(amount) * 100);
  const isFullRefund = amountCents === remainingCents;
  const isValid = Number.isInteger(amountCents) && amountCents > 0 && amountCents <= remainingCents;

  const mutation = useMutation({
    mutationFn: () => refundPayment(payment._id, { amount: amountCents, reason, restock: restock && isFullRefund }),
    onSuccess: () => {
      toast({ title: "Refund issued", tone: "success" });
      onSuccess();
    },
    onError: (err: Error) => {
      toast({ title: "Refund failed", description: err.message, tone: "danger" });
    },
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-[min(95vw,420px)] rounded-xs border border-border bg-bg p-5 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <div className="text-sm font-semibold">Refund Payment</div>
          <button type="button" onClick={onClose} className="text-fg/40 hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-4 text-xs text-fg/50">
          Paid {formatCurrencyFromCents(payment.amount)} · Available to refund {formatCurrencyFromCents(remainingCents)}
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-fg/70">Refund Amount (AUD)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={remainingDollars}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {!isValid && (
              <div className="mt-1 text-xs text-danger">
                Amount must be between $0.01 and {formatCurrencyFromCents(remainingCents)}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-fg/70">Reason</label>
            <NativeSelect value={reason} onChange={(e) => setReason(e.target.value as RefundReason)}>
              {REFUND_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          <label className="flex items-start gap-2 text-xs text-fg/70">
            <Checkbox checked={restock} onChange={(e) => setRestock(e.target.checked)} disabled={!isFullRefund} />
            <span>
              Restock items{" "}
              {!isFullRefund && (
                <span className="block text-fg/40">(only available for a full refund of the remaining amount)</span>
              )}
            </span>
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={mutation.isPending || !isValid}
            onClick={() => mutation.mutate()}
            className="flex-1"
          >
            {mutation.isPending ? "Refunding…" : "Issue Refund"}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
