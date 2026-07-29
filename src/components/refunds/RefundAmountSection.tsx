import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { formatCurrencyFromCents } from "@/utils/format";

interface RefundAmountSectionProps {
  amountDollars: string;
  onAmountChange: (value: string) => void;
  maxRefundable: number; // cents
  error?: string;
}

// refund-redesign-spec.md §7 — "Amount only: a single amount input capped
// at max_refundable. No restock control at all" (scope: amount never
// touches quantities/lines — see §3.5).
export function RefundAmountSection({ amountDollars, onAmountChange, maxRefundable, error }: RefundAmountSectionProps) {
  return (
    <FormField label="Refund Amount" required error={error}>
      <Input
        type="number"
        min="0.01"
        max={(maxRefundable / 100).toFixed(2)}
        step="0.01"
        value={amountDollars}
        onChange={(e) => onAmountChange(e.target.value)}
        placeholder="0.00"
        autoFocus
      />
      <div className="mt-1 text-xs text-fg/50">Up to {formatCurrencyFromCents(maxRefundable)} available</div>
    </FormField>
  );
}
