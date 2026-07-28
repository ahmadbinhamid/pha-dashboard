import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
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
import { recordOrderPayment } from "@/lib/api/orders";
import { PAYMENT_METHOD_LABEL } from "@/config/paymentMethods";
import { formatCurrencyFromCents } from "@/utils/format";
import type { PaymentMethod } from "@/types/payment";

interface RecordPaymentModalProps {
  orderId: string;
  balanceDueCents: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Staff-entered follow-up payment (cash/bank transfer) against an order's
// outstanding balance — e.g. collecting the rest of a manual sale's deposit.
export function RecordPaymentModal({ orderId, balanceDueCents, open, onOpenChange }: RecordPaymentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountInput, setAmountInput] = useState("");
  const [error, setError] = useState<string | undefined>();

  const balanceDueDollars = balanceDueCents / 100;

  const mutation = useMutation({
    mutationFn: () => recordOrderPayment(orderId, { payment_method: paymentMethod, amount: Number(amountInput) }),
    onSuccess: () => {
      toast({ title: "Payment recorded", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      reset();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't record payment", description: err.message, tone: "danger" });
    },
  });

  function reset() {
    setPaymentMethod("cash");
    setAmountInput("");
    setError(undefined);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(amountInput);
    if (!amount || amount <= 0) {
      setError("Enter an amount greater than $0");
      return;
    }
    if (amount > balanceDueDollars) {
      setError(`Amount can't exceed the balance due (${formatCurrencyFromCents(balanceDueCents)})`);
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
            <ModalTitle>Record Payment</ModalTitle>
            <ModalDescription>
              Log a cash or bank-transfer payment collected for this order — balance due is currently{" "}
              {formatCurrencyFromCents(balanceDueCents)}.
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <FormField label="Payment Method">
              <NativeSelect value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                <option value="cash">{PAYMENT_METHOD_LABEL.cash}</option>
                <option value="online_transfer">{PAYMENT_METHOD_LABEL.online_transfer}</option>
                <option value="efpos">{PAYMENT_METHOD_LABEL.efpos}</option>
              </NativeSelect>
            </FormField>
            <FormField label="Amount" required error={error}>
              <Input
                type="number"
                min={0}
                max={balanceDueDollars}
                step="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
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
            <Button type="submit" variant="primary" size="md" className="flex-1 gap-2" disabled={mutation.isPending}>
              <Wallet className="h-4 w-4" />
              {mutation.isPending ? "Saving…" : "Record Payment"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
