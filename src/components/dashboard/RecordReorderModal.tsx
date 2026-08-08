import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/Modal";
import { useToast } from "@/context";
import { adjustStock } from "@/lib/api/inventory";
import type { CriticalStockItem } from "@/types/dashboard";
import { recordReorderFormSchema, type RecordReorderFormValues } from "@/lib/validation/recordReorder";

interface RecordReorderModalProps {
  item: CriticalStockItem | null;
  onOpenChange: (open: boolean) => void;
}

// Quick "I've restocked this" action from the dashboard's Critical Stock
// table — credits the item's stock via the same adjustStock endpoint the
// full Inventory page uses, so history/marketplace sync stay consistent.
export function RecordReorderModal({ item, onOpenChange }: RecordReorderModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RecordReorderFormValues>({
    resolver: zodResolver(recordReorderFormSchema),
    defaultValues: { quantity: "" },
  });

  useEffect(() => {
    if (!item) reset({ quantity: "" });
  }, [item, reset]);

  const mutation = useMutation({
    mutationFn: (values: RecordReorderFormValues) =>
      adjustStock(item!.inventoryId, {
        adjustment: Number(values.quantity),
        reason: "Reordered from dashboard",
        type: "restock", // matches server/src/constants/inventory.constants.js#ADJUSTMENT_TYPE.RESTOCK
      }),
    onSuccess: () => {
      toast({ title: "Stock updated", description: `${item?.name} restocked.`, tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      reset({ quantity: "" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't update stock", description: err.message, tone: "danger" });
    },
  });

  const onSubmit = (values: RecordReorderFormValues) => mutation.mutate(values);

  return (
    <Modal
      open={!!item}
      onOpenChange={(next) => {
        if (!next) reset({ quantity: "" });
        onOpenChange(next);
      }}
    >
      <ModalContent className="max-w-sm">
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>
            <ModalTitle>Record Reorder</ModalTitle>
            <ModalDescription>
              {item && (
                <>
                  Add received stock for <span className="font-medium text-fg">{item.name}</span> ({item.sku}) —
                  currently {item.stockCount} on hand.
                </>
              )}
            </ModalDescription>
          </ModalHeader>

          <FormField label="Quantity received" required error={errors.quantity?.message}>
            <Input type="number" min={1} step="1" placeholder="e.g. 20" autoFocus {...register("quantity")} />
          </FormField>

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
            <Button type="submit" variant="primary" size="md" className="flex-1 gap-2" disabled={mutation.isPending}>
              <PackagePlus className="h-4 w-4" />
              {mutation.isPending ? "Saving…" : "Add Stock"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
