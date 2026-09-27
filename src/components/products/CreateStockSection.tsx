import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { MAIN_WAREHOUSE_NAME } from "@/config/locations";
import { PERMISSIONS } from "@/config/permissions";
import { useMyAccess } from "@/hooks/useMyAccess";
import { getLocations } from "@/lib/api/products";
import type { StockEntry } from "@/types/product";

interface CreateStockSectionProps {
  entries: StockEntry[];
  onChange: (entries: StockEntry[]) => void;
}

// Opening quantity at the single Main Warehouse; entries holds 0 or 1 item.
export function CreateStockSection({ entries, onChange }: CreateStockSectionProps) {
  const { can } = useMyAccess();
  const { data: locData } = useQuery({
    queryKey: ["locations"],
    queryFn: getLocations,
    enabled: can(PERMISSIONS.locations.view),
  });
  const mainWarehouse = (locData?.data ?? []).find((l) => l.is_active && l.name === MAIN_WAREHOUSE_NAME);
  const entry = entries[0];
  const qty = entry?.qty ?? 0;

  // No id (no locations.view) is fine: the server defaults to Main Warehouse.
  const setQty = (next: number) =>
    onChange([{ location_id: mainWarehouse?._id ?? null, location_name: MAIN_WAREHOUSE_NAME, qty: Math.max(0, next) }]);

  useEffect(() => {
    if (!entry || (mainWarehouse && entry.location_id !== mainWarehouse._id)) setQty(qty);
  }, [mainWarehouse?._id]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xs border border-border bg-bg px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-xs font-bold text-accent">
          MW
        </span>
        <div>
          <p className="text-sm font-medium text-fg">{MAIN_WAREHOUSE_NAME}</p>
          <p className="text-xs text-fg/50">Your only stock location</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-3xs font-semibold uppercase tracking-wide text-fg/40">Opening quantity</span>
        <div className="flex items-center rounded-md border border-border bg-card">
          <button
            type="button"
            onClick={() => setQty(qty - 1)}
            disabled={qty <= 0}
            className="flex h-8 w-8 items-center justify-center text-fg/60 transition hover:text-fg disabled:opacity-40"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <Input
            type="number"
            variant="ghost"
            min={0}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value) || 0)}
            className="h-auto w-14 rounded-none border-0 border-x border-border bg-transparent px-0 text-center text-sm tabular-nums shadow-none hover:bg-transparent focus-visible:border-border focus-visible:shadow-none"
          />
          <button
            type="button"
            onClick={() => setQty(qty + 1)}
            className="flex h-8 w-8 items-center justify-center text-fg/60 transition hover:text-fg disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
