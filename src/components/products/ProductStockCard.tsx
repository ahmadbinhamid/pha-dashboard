import { useState } from "react";
import { SetStockDialogFull } from "@/components/inventory/SetStockDialog";
import { useProductStockRecord } from "@/hooks/useProductStockRecord";
import type { InventoryRecord } from "@/types/inventory";

// Edit twin of CreateStockSection: live Main Warehouse count + Set stock.
export function ProductStockCard({ productId }: { productId: string }) {
  const [target, setTarget] = useState<InventoryRecord | null>(null);
  const { record, refetch } = useProductStockRecord(productId);

  if (!record) {
    return <div className="rounded-xs border border-border bg-bg px-4 py-3 text-sm text-fg/45">Setting up stock tracking…</div>;
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
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-3xs font-semibold uppercase tracking-wide text-fg/40">In stock</span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tabular-nums text-fg">{record.stock_count}</span>
            <button type="button" onClick={() => setTarget(record)} className="text-xs font-medium text-accent hover:underline">
              Set stock
            </button>
          </div>
        </div>
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
    </>
  );
}
