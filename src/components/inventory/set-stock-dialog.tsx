import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context";
import { setStock } from "@/lib/api/inventory";
import type { InventoryRecord } from "@/types/inventory";
import { X } from "lucide-react";

interface SetStockDialogFullProps {
  item: InventoryRecord;
  onClose: () => void;
}

export function SetStockDialogFull({ item, onClose }: SetStockDialogFullProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(String(item.stock_count));
  const [reason, setReason] = useState("");

  const productName =
    typeof item.product === "object" ? item.product.title : "Product";
  const variantName = item.variant?.display_name;

  const mutation = useMutation({
    mutationFn: () =>
      setStock(item._id, {
        stock_count: Number(value),
        reason: reason || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Stock set", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, tone: "danger" });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-[min(95vw,380px)] rounded-xs border border-border bg-bg p-5 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <div className="text-sm font-semibold">Set Stock</div>
          <button
            type="button"
            onClick={onClose}
            className="text-fg/40 hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-4 text-xs text-fg/50">
          {productName}
          {variantName ? ` — ${variantName}` : ""} @ {item.location?.name}
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-fg/70">
              New stock count
            </label>
            <Input
              type="number"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-fg/70">
              Reason (optional)
            </label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Physical count"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className="flex-1"
          >
            {mutation.isPending ? "Saving..." : "Set Stock"}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
