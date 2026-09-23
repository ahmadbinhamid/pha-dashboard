import { Checkbox } from "@/components/ui/Checkbox";

interface RefundEbayConfirmationProps {
  confirmed: boolean;
  onChange: (value: boolean) => void;
}

// refund-redesign-spec.md §5: eBay payments settle through eBay Managed Payments, so this is bookkeeping only — no gateway call, and restocking is a lie unless the refund was actually issued in Seller Hub. Server enforces this too (refund.service.js#createRefund).
export function RefundEbayConfirmation({ confirmed, onChange }: RefundEbayConfirmationProps) {
  return (
    <div className="rounded-md border border-warn/30 bg-warn/10 p-3">
      <label className="flex items-start gap-2 text-sm text-warn">
        <Checkbox checked={confirmed} onChange={(e) => onChange(e.target.checked)} />
        <span>
          I have already issued this refund in <strong>eBay Seller Hub</strong>. This order settles through eBay
          Managed Payments — this dialog only updates our own records and restocks inventory, it does not refund the
          buyer.
        </span>
      </label>
    </div>
  );
}
