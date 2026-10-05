import { useCallback, useState } from "react";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription } from "@/components/ui/Modal";
import { AddProductsStep } from "@/components/pos/steps/AddProductsStep";
import { CartTargetProvider, useToast } from "@/context";
import { useOrderEdit } from "@/hooks/useOrderEdit";
import { addOrderItem } from "@/lib/api/orders";
import { orderLineFromCartItem } from "@/lib/orders/orderLineFromCartItem";
import type { AddCartItemInput } from "@/types/cart";

interface AddOrderItemsButtonProps {
  orderId: string;
  version: number;
}

// Opens the create-order picker (custom lines included); each pick is saved.
export function AddOrderItemsButton({ orderId, version }: AddOrderItemsButtonProps) {
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const mutation = useOrderEdit(
    orderId,
    (item: AddCartItemInput) => addOrderItem(orderId, orderLineFromCartItem(item), version),
    { successTitle: "Item added", errorTitle: "Couldn't add item" },
  );

  // One add at a time: a second would carry a stale version.
  const onAdd = useCallback(
    (item: AddCartItemInput) => {
      if (mutation.isPending) {
        toast({ title: "Still saving the last item", description: "Try again in a moment.", tone: "warning" });
        return;
      }
      mutation.mutate(item);
    },
    [mutation, toast],
  );

  return (
    <CartTargetProvider onAdd={onAdd}>
      <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => setPickerOpen(true)}>
        <PackagePlus className="h-3.5 w-3.5" />
        Add product
      </Button>

      <Modal open={pickerOpen} onOpenChange={setPickerOpen}>
        <ModalContent className="max-w-3xl">
          <ModalHeader>
            <ModalTitle>Add products</ModalTitle>
            <ModalDescription>Each product you add is saved to the order straight away.</ModalDescription>
          </ModalHeader>
          <AddProductsStep />
        </ModalContent>
      </Modal>

    </CartTargetProvider>
  );
}
