import { Badge } from "@/components/ui/Badge";

export function CustomerAccountBadge({ hasOnlineAccount }: { hasOnlineAccount: boolean }) {
  return hasOnlineAccount ? <Badge variant="ok">Online Account</Badge> : <Badge variant="muted">Walk-in</Badge>;
}
