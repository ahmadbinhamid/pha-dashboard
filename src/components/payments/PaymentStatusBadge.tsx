import { Badge } from "@/components/ui/Badge";
import type { PaymentStatus } from "@/types/payment";

const VARIANT: Record<PaymentStatus, "ok" | "warn" | "danger" | "muted"> = {
  succeeded: "ok",
  pending: "warn",
  requires_action: "warn",
  failed: "danger",
  canceled: "muted",
};

const LABEL: Record<PaymentStatus, string> = {
  succeeded: "Succeeded",
  pending: "Pending",
  requires_action: "Requires Action",
  failed: "Failed",
  canceled: "Canceled",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}
