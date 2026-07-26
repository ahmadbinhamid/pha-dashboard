import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
import { setStock, getInventorySettings } from "@/lib/api/inventory";
import { STOCK_STATUS_CONFIG } from "@/config/stockStatus";
import { computeInventoryStockStatus } from "@/utils/inventoryStatus";
import type { InventoryRecord } from "@/types/inventory";

interface SetStockDialogFullProps {
  item: InventoryRecord | null;
  onOpenChange: (open: boolean) => void;
}

export function SetStockDialogFull({ item, onOpenChange }: SetStockDialogFullProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");

  const { data: settingsRes } = useQuery({
    queryKey: ["inventory-settings"],
    queryFn: getInventorySettings,
    staleTime: 60_000,
  });
  const lowStockThreshold = settingsRes?.data?.low_stock_threshold ?? 10;

  useEffect(() => {
    if (item) {
      setValue(String(item.stock_count));
      setReason("");
    }
  }, [item?._id]);

  const mutation = useMutation({
    mutationFn: () =>
      setStock(item!._id, {
        stock_count: Number(value),
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Stock set", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't set stock", description: err.message, tone: "danger" });
    },
  });

  const parsed = parseInt(value, 10);
  const isValid = !Number.isNaN(parsed) && parsed >= 0;
  const diff = item && isValid ? parsed - item.stock_count : 0;
  const statusConfig = item && isValid ? STOCK_STATUS_CONFIG[computeInventoryStockStatus(parsed, lowStockThreshold)] : null;

  const productName = item?.product?.title ?? "this item";
  const variantName = item?.variant?.display_name;

  return (
    <Modal open={!!item} onOpenChange={onOpenChange}>
      {item && (
        <ModalContent className="max-w-sm">
          <ModalHeader>
            <ModalTitle>Set Stock</ModalTitle>
            <ModalDescription>
              Set an exact stock count for{" "}
              <span className="font-medium text-fg">
                {productName}
                {variantName ? ` · ${variantName}` : ""}
              </span>
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <InventoryStockLocationSummary
              locationName={item.location?.name ?? "—"}
              currentLabel="Current Stock"
              current={item.stock_count}
            />

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-fg">
                New Stock Count <span className="text-danger">*</span>
              </label>
              <Input
                type="number"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter stock count"
                autoFocus
              />
              {isValid && (
                <div className="flex items-center justify-between pt-0.5">
                  {diff !== 0 ? (
                    <span className={diff > 0 ? "text-sm font-medium text-ok" : "text-sm font-medium text-danger"}>
                      {diff > 0 ? `+${diff}` : diff} from current
                    </span>
                  ) : (
                    <span />
                  )}
                  {statusConfig && <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg/60">Reason (optional)</label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Physical count"
                size="sm"
              />
            </div>
          </div>

          <ModalFooter>
            <Button type="button" variant="secondary" size="md" disabled={mutation.isPending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="md" disabled={!isValid || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Saving…" : "Set Stock"}
            </Button>
          </ModalFooter>
        </ModalContent>
      )}
    </Modal>
  );
}
