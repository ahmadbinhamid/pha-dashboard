import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { setStockFormSchema, type SetStockFormValues } from "@/lib/validation/setStock";

interface SetStockDialogFullProps {
  item: InventoryRecord | null;
  onOpenChange: (open: boolean) => void;
}

export function SetStockDialogFull({ item, onOpenChange }: SetStockDialogFullProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
  } = useForm<SetStockFormValues>({
    resolver: zodResolver(setStockFormSchema),
    defaultValues: { stock_count: "", reason: "" },
  });

  const value = watch("stock_count");

  const { data: settingsRes } = useQuery({
    queryKey: ["inventory-settings"],
    queryFn: getInventorySettings,
    staleTime: 60_000,
  });
  const lowStockThreshold = settingsRes?.data?.low_stock_threshold ?? 10;

  useEffect(() => {
    if (item) reset({ stock_count: String(item.stock_count), reason: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?._id]);

  const mutation = useMutation({
    mutationFn: (values: SetStockFormValues) =>
      setStock(item!._id, {
        stock_count: Number(values.stock_count),
        reason: values.reason.trim() || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Stock set", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      // Product.stock_count is a separate cached copy (Products list, the
      // product-edit page's live preview) — without this it stays stale
      // until an unrelated action happens to invalidate it, or a reload.
      queryClient.invalidateQueries({ queryKey: ["product"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't set stock", description: err.message, tone: "danger" });
    },
  });

  const onSubmit = (values: SetStockFormValues) => mutation.mutate(values);

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
          <form onSubmit={handleSubmit(onSubmit)}>
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
                  placeholder="Enter stock count"
                  autoFocus
                  {...register("stock_count")}
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
                <Input {...register("reason")} placeholder="e.g. Physical count" size="sm" />
              </div>
            </div>

            <ModalFooter>
              <Button type="button" variant="secondary" size="md" disabled={mutation.isPending} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="md" disabled={!isValid || mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Set Stock"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      )}
    </Modal>
  );
}
