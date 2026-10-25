import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { Modal, ModalContent, ModalHeader, ModalFooter, ModalTitle, ModalDescription } from "@/components/ui/Modal";
import { useOrderEdit } from "@/hooks/useOrderEdit";
import { updateCustomItemDetails } from "@/lib/api/orders";
import { OPTIONAL_AUTHENTICITY_OPTIONS, OPTIONAL_CONDITION_OPTIONS } from "@/config/productOptions";
import { customItemDetailsSchema, type CustomItemDetailsFormValues } from "@/lib/validation/customItemDetails";
import type { OrderItem } from "@/types/orders";

interface EditCustomItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  version: number;
  item: OrderItem;
}

// Price, qty and discount stay in the table, where unpaid-only rules apply.
export function EditCustomItemModal({ open, onOpenChange, orderId, version, item }: EditCustomItemModalProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomItemDetailsFormValues>({ resolver: zodResolver(customItemDetailsSchema) });

  useEffect(() => {
    if (open) reset({ name: item.name, condition: item.condition ?? "", authenticity: item.authenticity ?? "" });
  }, [open, item, reset]);

  const mutation = useOrderEdit(
    orderId,
    (values: CustomItemDetailsFormValues) =>
      updateCustomItemDetails(
        orderId,
        item._id,
        { name: values.name, condition: values.condition || null, authenticity: values.authenticity || null },
        version,
      ),
    { successTitle: "Custom product updated", errorTitle: "Couldn't update custom product", onSuccess: () => onOpenChange(false) },
  );

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <ModalHeader>
            <ModalTitle>Edit custom product</ModalTitle>
            <ModalDescription>Changes show on the invoice; the price and totals stay the same.</ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <FormField label="Title" required error={errors.name?.message}>
              <Input {...register("name")} autoFocus />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Condition">
                <Controller
                  control={control}
                  name="condition"
                  render={({ field }) => (
                    <SingleSelect
                      options={OPTIONAL_CONDITION_OPTIONS}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              </FormField>
              <FormField label="Authenticity">
                <Controller
                  control={control}
                  name="authenticity"
                  render={({ field }) => (
                    <SingleSelect
                      options={OPTIONAL_AUTHENTICITY_OPTIONS}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              </FormField>
            </div>
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="flex-1"
              disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
