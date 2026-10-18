import { Badge } from "@/components/ui/Badge";
import { DISCOUNT_STATUS_CONFIG } from "@/config/discounts";
import type { DiscountStatus } from "@/types/discount";

export function DiscountStatusBadge({ status }: { status: DiscountStatus }) {
  const { label, variant } = DISCOUNT_STATUS_CONFIG[status];
  return <Badge variant={variant}>{label}</Badge>;
}
