import { Badge } from "@/components/ui/Badge";
import { CONTACT_STATUS_BADGE } from "@/config/campaigns";
import type { ContactStatus } from "@/types/campaign";

export function ContactStatusBadge({ status }: { status: ContactStatus }) {
  const { label, variant } = CONTACT_STATUS_BADGE[status];
  return <Badge variant={variant}>{label}</Badge>;
}
