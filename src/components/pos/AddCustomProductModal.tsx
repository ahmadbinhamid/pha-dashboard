import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Modal, ModalContent, ModalHeader, ModalFooter, ModalTitle, ModalDescription } from "@/components/ui/Modal";
import { useCartActions } from "@/context/cart";
import { buildCustomCartItem } from "@/lib/cart/customCartItem";
import { customOrderItemSchema, type CustomOrderItemFormValues } from "@/lib/validation/customOrderItem";

interface AddCustomProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_VALUES: CustomOrderItemFormValues = { title: "", price: "", shipping: "", discount: "" };

// Order-only line: lives in the cart and this order, never in the catalogue.
export function AddCustomProductModal({ open, onOpenChange }: AddCustomProductModalProps) {
  const { addItem } = useCartActions();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomOrderItemFormValues>({
    resolver: zodResolver(customOrderItemSchema),
    defaultValues: EMPTY_VALUES,
  });

  // Modal stays mounted between opens, so clear the previous entry on close.
  useEffect(() => {
    if (!open) reset(EMPTY_VALUES);
  }, [open, reset]);

  const onSubmit = (values: CustomOrderItemFormValues) => {
    addItem(buildCustomCartItem(values));
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>
            <ModalTitle>Add custom product</ModalTitle>
            <ModalDescription>
              Only added to this order; it won't appear in products or inventory.
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <FormField label="Title" required error={errors.title?.message}>
              <Input {...register("title")} placeholder="e.g. Fitting labour" autoFocus />
            </FormField>
            <FormField label="Price" required error={errors.price?.message}>
              <Input {...register("price")} type="number" min={0} step="0.01" placeholder="0.00" />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Shipping (per unit)" error={errors.shipping?.message}>
                <Input {...register("shipping")} type="number" min={0} step="0.01" placeholder="0.00" />
              </FormField>
              <FormField label="Discount" error={errors.discount?.message}>
                <Input {...register("discount")} type="number" min={0} step="0.01" placeholder="0.00" />
              </FormField>
            </div>
          </div>

          <ModalFooter>
            <Button type="button" variant="secondary" size="md" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" className="flex-1">
              Add to order
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
