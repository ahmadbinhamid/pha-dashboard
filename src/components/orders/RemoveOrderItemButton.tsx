import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useOrderEdit } from "@/hooks/useOrderEdit";
import { removeOrderItem } from "@/lib/api/orders";
import type { OrderItem } from "@/types/orders";

interface RemoveOrderItemButtonProps {
  orderId: string;
  version: number;
  item: OrderItem;
  // The last line can't go; the server enforces it too.
  disabled?: boolean;
}

export function RemoveOrderItemButton({ orderId, version, item, disabled }: RemoveOrderItemButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const mutation = useOrderEdit(orderId, () => removeOrderItem(orderId, item._id, version), {
    successTitle: "Item removed",
    errorTitle: "Couldn't remove item",
    onSuccess: () => setConfirming(false),
  });

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-fg/50 hover:text-danger"
        disabled={disabled || mutation.isPending}
        onClick={() => setConfirming(true)}
        aria-label={`Remove ${item.name}`}
        title={disabled ? "An order must keep at least one item" : undefined}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      <ConfirmModal
        open={confirming}
        onOpenChange={setConfirming}
        title="Remove this item?"
        description={`${item.quantity} × ${item.name} will be removed from the order.`}
        confirmLabel="Remove"
        tone="danger"
        confirming={mutation.isPending}
        onConfirm={() => mutation.mutate(undefined)}
      />
    </>
  );
}
