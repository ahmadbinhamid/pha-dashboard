import { Checkbox } from "@/components/ui/Checkbox";

interface RefundEbayConfirmationProps {
  confirmed: boolean;
  onChange: (value: boolean) => void;
}

// refund-redesign-spec.md §5 — an eBay-channel payment settles through eBay
// Managed Payments, so this refund is bookkeeping only: there's no gateway
// call, and restocking pushes the SKU's quantity back UP on the live eBay
// listing. If the refund hasn't actually been issued in eBay Seller Hub,
// that restock is a lie — stock rises while the sale (and eBay's cut) still
// stands. The server independently enforces this same requirement
// (refund.service.js#createRefund) regardless of what this checkbox sends.
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
