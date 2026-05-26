import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context";
import { adjustStock } from "@/lib/api/inventory";
import type { InventoryRecord } from "@/types/inventory";
import { Minus, Plus, X } from "lucide-react";

const ADJUST_TYPES = [
  { value: "restock", label: "Restock" },
  { value: "damaged", label: "Damaged" },
  { value: "lost", label: "Lost" },
  { value: "stolen", label: "Stolen" },
  { value: "correction", label: "Correction" },
  { value: "transfer_in", label: "Transfer In" },
  { value: "transfer_out", label: "Transfer Out" },
  { value: "other", label: "Other" },
];

interface AdjustStockDialogProps {
  item: InventoryRecord;
  onClose: () => void;
}

export function AdjustStockDialog({ item, onClose }: AdjustStockDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("0");
  const [reason, setReason] = useState("");
  const [type, setType] = useState("other");
  const isNeg = Number(value) < 0;

  const productName =
    typeof item.product === "object" ? item.product.title : "Product";
  const variantName = item.variant?.display_name;

  const mutation = useMutation({
    mutationFn: () =>
      adjustStock(item._id, {
        adjustment: Number(value),
        reason: reason || undefined,
        type,
      }),
    onSuccess: () => {
      toast({ title: "Stock adjusted", tone: "success" });
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
      <div className="relative z-10 w-[min(95vw,420px)] rounded-xl border border-border bg-bg p-5 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <div className="text-sm font-semibold">Adjust Stock</div>
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
              Adjustment
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-10 w-10 shrink-0 p-0"
                onClick={() => setValue((v) => String(Number(v) - 1))}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={`text-center ${isNeg ? "text-danger" : ""}`}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-10 w-10 shrink-0 p-0"
                onClick={() => setValue((v) => String(Number(v) + 1))}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="mt-1 text-xs text-fg/40">
              Current: {item.stock_count} → New:{" "}
              {Math.max(0, item.stock_count + Number(value))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-fg/70">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-bg"
            >
              {ADJUST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-fg/70">
              Reason (optional)
            </label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Received new shipment"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={mutation.isPending || !value || value === "0"}
            onClick={() => mutation.mutate()}
            className="flex-1"
          >
            {mutation.isPending ? "Saving..." : "Adjust"}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
