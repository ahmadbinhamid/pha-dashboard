import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { NativeSelect } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/Modal";
import { InventoryStockLocationSummary } from "@/components/inventory/InventoryStockLocationSummary";
import { useToast } from "@/context";
import { adjustStock, getInventorySettings } from "@/lib/api/inventory";
import { POSITIVE_ADJUST_REASONS, NEGATIVE_ADJUST_REASONS } from "@/config/inventoryAdjustTypes";
import { STOCK_STATUS_CONFIG } from "@/config/stockStatus";
import { computeInventoryStockStatus } from "@/utils/inventoryStatus";
import type { InventoryRecord, InventoryAdjustType } from "@/types/inventory";

interface AdjustStockDialogProps {
  item: InventoryRecord | null;
  onOpenChange: (open: boolean) => void;
}

// Relative +/- stock change — distinct from Set Stock's absolute count. The
// reason dropdown's options flip with the sign of the adjustment (you can't
// "restock" a decrease, or mark an increase "damaged").
export function AdjustStockDialog({ item, onOpenChange }: AdjustStockDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adjustment, setAdjustment] = useState(0);
  const [type, setType] = useState<InventoryAdjustType | "">("");
  const [note, setNote] = useState("");
  const prevSignRef = useRef(0);

  const { data: settingsRes } = useQuery({
    queryKey: ["inventory-settings"],
    queryFn: getInventorySettings,
    staleTime: 60_000,
  });
  const lowStockThreshold = settingsRes?.data?.low_stock_threshold ?? 10;

  useEffect(() => {
    if (item) {
      setAdjustment(0);
      setType("");
      setNote("");
      prevSignRef.current = 0;
    }
  }, [item?._id]);

  // Reset the reason whenever the adjustment flips from increase to decrease
  // (or vice versa) — the previous choice may no longer be a valid option.
  useEffect(() => {
    const sign = adjustment > 0 ? 1 : adjustment < 0 ? -1 : 0;
    if (sign !== 0 && sign !== prevSignRef.current) setType("");
    prevSignRef.current = sign;
  }, [adjustment]);

  const mutation = useMutation({
    mutationFn: () =>
      adjustStock(item!._id, {
        adjustment,
        type: type || undefined,
        reason: note.trim() || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Stock adjusted", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't adjust stock", description: err.message, tone: "danger" });
    },
  });

  const handleAmountChange = (val: string) => {
    if (val === "" || val === "-") {
      setAdjustment(0);
      return;
    }
    const n = parseInt(val, 10);
    if (!Number.isNaN(n)) setAdjustment(n);
  };

  const resultingStock = item ? item.stock_count + adjustment : 0;
  const isPositive = adjustment > 0;
  const isNegative = adjustment < 0;
  const reasons = isNegative ? NEGATIVE_ADJUST_REASONS : POSITIVE_ADJUST_REASONS;
  const canSave = adjustment !== 0 && resultingStock >= 0;
  const statusConfig = adjustment !== 0 ? STOCK_STATUS_CONFIG[computeInventoryStockStatus(resultingStock, lowStockThreshold)] : null;

  const productName = item?.product?.title ?? "this item";
  const variantName = item?.variant?.display_name;

  return (
    <Modal open={!!item} onOpenChange={onOpenChange}>
      {item && (
        <ModalContent className="max-w-sm">
          <ModalHeader>
            <ModalTitle>Adjust Stock</ModalTitle>
            <ModalDescription>
              Update the stock count for{" "}
              <span className="font-medium text-fg">
                {productName}
                {variantName ? ` · ${variantName}` : ""}
              </span>
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <InventoryStockLocationSummary
              locationName={item.location?.name ?? "—"}
              current={item.stock_count}
              next={adjustment !== 0 ? resultingStock : undefined}
            />

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-fg">
                Adjustment <span className="text-danger">*</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustment((v) => v - 1)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-card text-fg/70 transition hover:border-accent/50 hover:text-fg"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <Input
                  type="number"
                  value={adjustment === 0 ? "0" : String(adjustment)}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="h-10 flex-1 text-center text-base font-semibold"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setAdjustment((v) => v + 1)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-card text-fg/70 transition hover:border-accent/50 hover:text-fg"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {adjustment !== 0 && (
                <div className="flex items-center justify-between pt-0.5">
                  <span className={isPositive ? "text-sm font-medium text-ok" : "text-sm font-medium text-danger"}>
                    {isPositive ? `+${adjustment}` : adjustment} units
                  </span>
                  {statusConfig && <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>}
                </div>
              )}
              {resultingStock < 0 && <p className="text-xs text-danger">Resulting stock cannot be negative.</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-fg">Reason</label>
              <NativeSelect
                value={type}
                onChange={(e) => setType(e.target.value as InventoryAdjustType)}
                disabled={adjustment === 0}
              >
                <option value="">{adjustment === 0 ? "Set adjustment first…" : "Select a reason…"}</option>
                {reasons.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg/60">Note (optional)</label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Delivery from supplier"
                size="sm"
              />
            </div>
          </div>

          <ModalFooter>
            <Button type="button" variant="secondary" size="md" disabled={mutation.isPending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="md" disabled={!canSave || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </ModalFooter>
        </ModalContent>
      )}
    </Modal>
  );
}
