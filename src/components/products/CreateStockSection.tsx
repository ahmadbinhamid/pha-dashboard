import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { getLocations } from "@/lib/api/products";
import type { StockEntry } from "@/types/product";

interface CreateStockSectionProps {
  entries: StockEntry[];
  onChange: (entries: StockEntry[]) => void;
}

// This system has exactly one stock location (Main Warehouse) — no picker,
// just an opening-quantity control for it. `entries` stays a 0-or-1-item
// array only to keep the FormData payload shape unchanged on submit.
export function CreateStockSection({ entries, onChange }: CreateStockSectionProps) {
  const { data: locData } = useQuery({ queryKey: ["locations"], queryFn: getLocations });
  const mainWarehouse = (locData?.data ?? []).find((l) => l.is_active && l.name === "Main Warehouse");
  const entry = entries[0];

  useEffect(() => {
    if (mainWarehouse && !entry) {
      onChange([{ location_id: mainWarehouse._id, location_name: mainWarehouse.name, qty: 0 }]);
    }
  }, [mainWarehouse?._id]);

  const qty = entry?.qty ?? 0;

  const setQty = (next: number) => {
    if (!mainWarehouse) return;
    onChange([{ location_id: mainWarehouse._id, location_name: mainWarehouse.name, qty: Math.max(0, next) }]);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xs border border-border bg-bg px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-xs font-bold text-accent">
          MW
        </span>
        <div>
          <p className="text-sm font-medium text-fg">Main Warehouse</p>
          <p className="text-xs text-fg/50">Your only stock location</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-fg/40">Opening quantity</span>
        <div className="flex items-center rounded-md border border-border bg-card">
          <button
            type="button"
            onClick={() => setQty(qty - 1)}
            disabled={!mainWarehouse}
            className="flex h-8 w-8 items-center justify-center text-fg/60 transition hover:text-fg disabled:opacity-40"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            type="number"
            min={0}
            value={qty}
            disabled={!mainWarehouse}
            onChange={(e) => setQty(Number(e.target.value) || 0)}
            className="w-14 border-x border-border bg-transparent text-center text-sm tabular-nums outline-none!"
          />
          <button
            type="button"
            onClick={() => setQty(qty + 1)}
            disabled={!mainWarehouse}
            className="flex h-8 w-8 items-center justify-center text-fg/60 transition hover:text-fg disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
