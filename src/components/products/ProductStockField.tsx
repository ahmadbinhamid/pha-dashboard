import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { SetStockDialogFull } from "@/components/inventory/SetStockDialog";
import { useProductStockRecord } from "@/hooks/useProductStockRecord";
import type { InventoryRecord } from "@/types/inventory";

// Compact stock value + "Set stock" for a product with one location.
export function ProductStockField({ productId }: { productId: string }) {
  const [target, setTarget] = useState<InventoryRecord | null>(null);
  const { record, refetch } = useProductStockRecord(productId);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Label>Stock</Label>
        <span className="ml-auto truncate text-xs text-fg/45">{record?.location?.name ?? "Main Warehouse"}</span>
      </div>
      <div className="flex h-10 items-center justify-between rounded-xl border border-border bg-bg-2 pl-3 pr-1">
        <span className="text-sm font-semibold tabular-nums text-fg">{record ? record.stock_count : "…"}</span>
        <Button type="button" variant="ghost" size="sm" className="h-8 text-accent" disabled={!record} onClick={() => setTarget(record ?? null)}>
          Set stock
        </Button>
      </div>
      <SetStockDialogFull
        item={target}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            void refetch();
          }
        }}
      />
    </div>
  );
}
