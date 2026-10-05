import { Info, Lock } from "lucide-react";
import { ORDER_PAYMENT_LINK_EDIT_NOTE } from "@/config/orderEdit";

interface OrderEditNoticeProps {
  // Null when the order is editable.
  blockReason: string | null;
}

// Under the totals: why editing is off, or that the payment link still works.
export function OrderEditNotice({ blockReason }: OrderEditNoticeProps) {
  const Icon = blockReason ? Lock : Info;
  return (
    <p className="flex items-start gap-1.5 pt-1 text-xs text-fg/55">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {blockReason ?? ORDER_PAYMENT_LINK_EDIT_NOTE}
    </p>
  );
}
