import { useQueryClient, useMutation } from "@tanstack/react-query";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { ORDER_STATUS_LABEL } from "@/components/orders/OrderStatusBadge";
import { useToast } from "@/context";
import { updateOrderStatus } from "@/lib/api/orders";
import { cn } from "@/utils/cn";
import type { OrderFulfillmentStatus } from "@/types/orders";

const STATUSES: OrderFulfillmentStatus[] = ["pending", "processing", "on_hold", "completed", "cancelled"];

const DOT_COLOR: Record<OrderFulfillmentStatus, string> = {
  pending: "bg-tag-warn-fg",
  processing: "bg-fg/50",
  on_hold: "bg-tag-warn-fg",
  completed: "bg-tag-success-fg",
  cancelled: "bg-tag-danger-fg",
};

// Dot + label per status; the trigger mirrors the selected item.
const STATUS_OPTIONS = STATUSES.map((status) => ({
  value: status,
  label: (
    <span className="flex items-center gap-2">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT_COLOR[status])} />
      {ORDER_STATUS_LABEL[status]}
    </span>
  ),
}));

// Lifecycle only; payment status (OrderPaymentStatusBadge) is separate.
export function OrderStatusSelect({ order }: { order: { _id: string; fulfillment_status: OrderFulfillmentStatus } }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (status: OrderFulfillmentStatus) => updateOrderStatus(order._id, status),
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
      <SingleSelect
        size="sm"
        options={STATUS_OPTIONS}
        value={order.fulfillment_status}
        onChange={(value) => mutation.mutate(value as OrderFulfillmentStatus)}
        disabled={mutation.isPending}
      />
    </div>
  );
}
