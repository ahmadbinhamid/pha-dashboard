import { QuantityStepper } from "@/components/pos/QuantityStepper";
import { useOrderEdit } from "@/hooks/useOrderEdit";
import { updateOrderItemQuantity } from "@/lib/api/orders";
import type { OrderItem } from "@/types/orders";

interface OrderItemQuantityStepperProps {
  orderId: string;
  version: number;
  item: OrderItem;
}

// Each change is saved at once; the server moves stock and returns new totals.
export function OrderItemQuantityStepper({ orderId, version, item }: OrderItemQuantityStepperProps) {
  const mutation = useOrderEdit(
    orderId,
    (quantity: number) => updateOrderItemQuantity(orderId, item._id, quantity, version),
    { successTitle: "Quantity updated", errorTitle: "Couldn't update quantity" },
  );

  return (
    <QuantityStepper
      value={item.quantity}
      onChange={(quantity) => mutation.mutate(quantity)}
      editable
      disabled={mutation.isPending}
      className="justify-self-end"
    />
  );
}
