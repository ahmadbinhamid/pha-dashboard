import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SetStockDialogFull } from "@/components/inventory/SetStockDialog";
import { useToast } from "@/context";
import { getInventory, ensureInventoryRecord } from "@/lib/api/inventory";
import { getLocations } from "@/lib/api/products";
import type { InventoryRecord } from "@/types/inventory";

interface ProductStockCardProps {
  productId: string;
  variantId?: string;
}

// This system has exactly one stock location (Main Warehouse) — silently
// ensures an inventory record exists for it instead of offering a location
// picker that only ever has one real option. The user can only adjust the count.
export function ProductStockCard({ productId, variantId }: ProductStockCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [setStockTarget, setSetStockTarget] = useState<InventoryRecord | null>(null);
  const variantParam = variantId ?? "null";

  const { data: invData, refetch: refetchInv } = useQuery({
    queryKey: ["inventory", "product-stock", productId, variantParam],
    queryFn: () => getInventory({ product: productId, variant: variantParam, limit: 1 }),
  });
  const record: InventoryRecord | undefined = invData?.data?.items?.[0];

  const { data: locData } = useQuery({
    queryKey: ["locations"],
    queryFn: getLocations,
    enabled: !record,
  });
  const mainWarehouse = (locData?.data ?? []).find((l) => l.is_active && l.name === "Main Warehouse");

  const ensureMutation = useMutation({
    mutationFn: () =>
      ensureInventoryRecord({ product: productId, variant: variantId ?? null, location: mainWarehouse!._id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      refetchInv();
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't set up stock tracking", description: err.message, tone: "danger" });
    },
  });

  useEffect(() => {
    if (!record && mainWarehouse && !ensureMutation.isPending) {
      ensureMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, mainWarehouse?._id]);

  if (!record) {
    return (
      <div className="rounded-xs border border-border bg-bg px-4 py-3 text-sm text-fg/45">
        Setting up stock tracking…
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xs border border-border bg-bg px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-xs font-bold text-accent">
            MW
          </span>
          <div>
            <p className="text-sm font-medium text-fg">{record.location?.name ?? "Main Warehouse"}</p>
            <p className="text-xs text-fg/50">Your only stock location</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm font-semibold tabular-nums text-fg">{record.stock_count} in stock</span>
          <button
            type="button"
            onClick={() => setSetStockTarget(record)}
            className="text-xs font-medium text-accent hover:underline"
          >
            Set Stock
          </button>
        </div>
      </div>

      <SetStockDialogFull
        item={setStockTarget}
        onOpenChange={(open) => {
          if (!open) {
            setSetStockTarget(null);
            refetchInv();
          }
        }}
      />
    </>
  );
}
