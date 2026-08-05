import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { ORDER_STATUS_LABEL } from "@/components/orders/OrderStatusBadge";
import { useToast } from "@/context";
import { updateOrderStatus } from "@/lib/api/orders";
import { cn } from "@/utils/cn";
import type { OrderStatus, EditableOrderStatus } from "@/types/orders";

const EDITABLE_STATUSES: EditableOrderStatus[] = ["pending_payment", "partially_paid", "paid", "fulfilled", "cancelled"];

// Refunded/partially_refunded are only ever reached through the dedicated
// refund flow — this dropdown is locked (read-only) for those, matching the
// same restriction the backend enforces (order.service.js#updateOrderStatus).
const LOCKED_STATUSES = new Set<OrderStatus>(["refunded", "partially_refunded"]);

const DOT_COLOR: Record<OrderStatus, string> = {
  pending_payment: "bg-tag-warn-fg",
  partially_paid: "bg-tag-warn-fg",
  paid: "bg-tag-success-fg",
  fulfilled: "bg-fg/50",
  cancelled: "bg-fg/30",
  refunded: "bg-tag-danger-fg",
  partially_refunded: "bg-tag-warn-fg",
};

export function OrderStatusSelect({ order }: { order: { _id: string; status: OrderStatus } }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const locked = LOCKED_STATUSES.has(order.status);

  const mutation = useMutation({
    mutationFn: (status: EditableOrderStatus) => updateOrderStatus(order._id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", order._id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Order status updated", tone: "success" });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't update status", description: err.message, tone: "danger" });
    },
  });

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-fg/50">Status</span>
      <Select
        value={order.status}
        onValueChange={(value) => mutation.mutate(value as EditableOrderStatus)}
        disabled={locked || mutation.isPending}
      >
        <SelectTrigger className="h-9 w-auto min-w-36 gap-2 text-sm">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT_COLOR[order.status])} />
          <SelectValue>{ORDER_STATUS_LABEL[order.status]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {EDITABLE_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              <span className="flex items-center gap-2">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT_COLOR[status])} />
                {ORDER_STATUS_LABEL[status]}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
