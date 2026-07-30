import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/context";
import { voidRefund as voidRefundApi } from "@/lib/api/refunds";
import { formatCurrencyFromCents } from "@/utils/format";
import { REFUND_REASON_LABEL } from "@/config/refundReasons";
import type { Refund, RefundStatus } from "@/types/refund";

const REFUND_STATUS_VARIANT: Record<RefundStatus, "ok" | "warn" | "danger" | "muted"> = {
  succeeded: "ok",
  processing: "warn",
  pending: "warn",
  failed: "danger",
  canceled: "danger",
  voided: "muted",
};

// refund-redesign-spec.md §1.3/§2.3 — order-scoped history (scope, refund_number,
// total_amount, needs_reconciliation), with a void action for a succeeded
// refund (§3.8). Replaces the old payment-scoped, `amount`-only version.
export function RefundHistoryList({ orderId, refunds }: { orderId: string; refunds: Refund[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const voidMutation = useMutation({
    mutationFn: (refundId: string) => voidRefundApi(refundId, "Voided from order detail page"),
    onSuccess: () => {
      toast({ title: "Refund voided", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["order-refunds", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order-refundable", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      setVoidingId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't void refund", description: err.message, tone: "danger" });
      setVoidingId(null);
    },
  });

  if (refunds.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-fg/45">
        No refunds yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {refunds.map((refund) => (
        <div key={refund._id} className="rounded-lg border border-border bg-bg-2/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-fg">{formatCurrencyFromCents(refund.total_amount)}</span>
            <div className="flex items-center gap-1.5">
              {refund.needs_reconciliation && <Badge variant="warn">Needs reconciliation</Badge>}
              <Badge variant={REFUND_STATUS_VARIANT[refund.status]}>{refund.status}</Badge>
            </div>
          </div>
          <div className="mt-1 text-xs text-fg/55">
            {refund.refund_number ?? "—"} · {refund.scope ? refund.scope.replace("_", " ") : "unmigrated"} ·{" "}
            {REFUND_REASON_LABEL[refund.reason] ?? refund.reason}
            {refund.initiated_via === "stripe_dashboard" && " — via Stripe Dashboard"}
            {refund.initiated_via === "manual" && " — recorded manually"}
          </div>
          {refund.lines.length > 0 && (
            <div className="mt-1.5 space-y-0.5 text-xs text-fg/60">
              {refund.lines.map((line) => (
                <div key={line.order_item_id} className="flex justify-between">
                  <span className="truncate">
                    {line.name} × {line.quantity}
                    {line.restock && " (restocked)"}
                  </span>
                  <span>{formatCurrencyFromCents(line.line_amount)}</span>
                </div>
              ))}
            </div>
          )}
          {refund.failure_reason && <div className="mt-1 text-xs text-danger">{refund.failure_reason}</div>}
          {refund.void_reason && <div className="mt-1 text-xs text-fg/50">Voided: {refund.void_reason}</div>}
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[10px] text-fg/40">{new Date(refund.created_at).toLocaleString()}</span>
            {refund.status === "succeeded" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-xs text-fg/50 hover:text-danger"
                disabled={voidMutation.isPending && voidingId === refund._id}
                onClick={() => {
                  setVoidingId(refund._id);
                  voidMutation.mutate(refund._id);
                }}
              >
                <Undo2 className="h-3 w-3" />
                {voidMutation.isPending && voidingId === refund._id ? "Voiding…" : "Void"}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
