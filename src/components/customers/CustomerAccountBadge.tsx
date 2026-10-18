import { Badge } from "@/components/ui/Badge";
import type { CustomerSource } from "@/types/customer";

interface CustomerAccountBadgeProps {
  hasOnlineAccount: boolean;
  // Omitted where only the account matters, e.g. the customer header.
  source?: CustomerSource;
}

export function CustomerAccountBadge({ hasOnlineAccount, source }: CustomerAccountBadgeProps) {
  if (hasOnlineAccount) return <Badge variant="ok">Online Account</Badge>;
  if (source === "storefront") return <Badge variant="outline">Website</Badge>;
  return <Badge variant="muted">Walk-in</Badge>;
}
