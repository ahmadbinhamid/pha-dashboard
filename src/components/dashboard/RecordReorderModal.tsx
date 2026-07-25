import { useState } from "react";
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
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | undefined>();

  const mutation = useMutation({
    mutationFn: () =>
      adjustStock(item!.inventoryId, {
        adjustment: Number(quantity),
        reason: "Reordered from dashboard",
        type: "restock", // matches server/src/constants/inventory.constants.js#ADJUSTMENT_TYPE.RESTOCK
      }),
    onSuccess: () => {
      toast({ title: "Stock updated", description: `${item?.name} restocked.`, tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      reset();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't update stock", description: err.message, tone: "danger" });
    },
  });

  function reset() {
    setQuantity("");
    setError(undefined);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError("Enter a quantity greater than 0");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={!!item}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <ModalContent className="max-w-sm">
        <form onSubmit={handleSubmit}>
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

          <FormField label="Quantity received" required error={error}>
            <Input
              type="number"
              min={1}
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 20"
              autoFocus
            />
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
