import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { NativeSelect } from "@/components/ui/Select";
import { cn } from "@/utils/cn";
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
import { ADJUST_TYPE_OPTIONS } from "@/config/inventoryAdjustTypes";
import type { InventoryRecord, InventoryAdjustType } from "@/types/inventory";

interface AdjustStockDialogProps {
  item: InventoryRecord | null;
  onOpenChange: (open: boolean) => void;
}

type Direction = "add" | "remove";

// Relative +/- stock change — distinct from Set Stock's absolute count.
// Every adjustment is attributed a type + optional reason so the resulting
// history entry (View History) explains why the count moved.
export function AdjustStockDialog({ item, onOpenChange }: AdjustStockDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<Direction>("add");
  const [qty, setQty] = useState("");
  const [type, setType] = useState<InventoryAdjustType>("restock");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (item) {
      setDirection("add");
      setQty("");
      setType("restock");
      setReason("");
    }
  }, [item?._id]);

  const mutation = useMutation({
    mutationFn: () => {
      const amount = Number(qty) || 0;
      const adjustment = direction === "add" ? amount : -amount;
      return adjustStock(item!._id, { adjustment, reason: reason || undefined, type });
    },
    onSuccess: () => {
      toast({ title: "Stock adjusted", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't adjust stock", description: err.message, tone: "danger" });
    },
  });

  const qtyNumber = Number(qty);
  const canSubmit = qty !== "" && qtyNumber > 0;
  const productName = item?.product?.title ?? "Product";
  const variantName = item?.variant?.display_name;

  return (
    <Modal open={!!item} onOpenChange={onOpenChange}>
      {item && (
        <ModalContent className="max-w-sm">
          <ModalHeader>
            <ModalTitle>Adjust Stock</ModalTitle>
            <ModalDescription>
              {productName}
              {variantName ? ` — ${variantName}` : ""} @ {item.location?.name} · currently {item.stock_count} on hand
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <div className="inline-flex w-full rounded-md border border-border bg-bg-2/40 p-0.5">
              <button
                type="button"
                onClick={() => setDirection("add")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-sm py-1.5 text-sm font-medium transition",
                  direction === "add" ? "bg-card text-ok shadow-sm" : "text-fg/50 hover:text-fg",
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
              <button
                type="button"
                onClick={() => setDirection("remove")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-sm py-1.5 text-sm font-medium transition",
                  direction === "remove" ? "bg-card text-danger shadow-sm" : "text-fg/50 hover:text-fg",
                )}
              >
                <Minus className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>

            <FormField label="Quantity" required>
              <Input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="e.g. 20"
                autoFocus
              />
            </FormField>

            <FormField label="Reason type">
              <NativeSelect value={type} onChange={(e) => setType(e.target.value as InventoryAdjustType)}>
                {ADJUST_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </NativeSelect>
            </FormField>

            <FormField label="Note (optional)">
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Delivery from supplier"
              />
            </FormField>
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
            <Button
              type="button"
              variant="primary"
              size="md"
              className="flex-1"
              disabled={!canSubmit || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Saving…" : "Adjust Stock"}
            </Button>
          </ModalFooter>
        </ModalContent>
      )}
    </Modal>
  );
}
