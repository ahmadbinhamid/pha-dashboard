import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdjustStockDialog } from "@/components/inventory/adjust-stock-dialog";
import { SetStockDialogFull } from "@/components/inventory/set-stock-dialog";
import { HistoryDrawer } from "@/components/inventory/history-drawer";
import {
  InventoryRow,
  InventoryEmptyState,
} from "@/components/inventory/inventory-row";
import { getInventory, getInventorySettings } from "@/lib/api/inventory";
import { getLocations } from "@/lib/api/products";
import type { InventoryRecord } from "@/types/inventory";
import type { Location } from "@/types/product";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

export default function InventoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const locationFilter = searchParams.get("location") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1", 10);

  const [inputValue, setInputValue] = useState(search);
  const [adjustItem, setAdjustItem] = useState<InventoryRecord | null>(null);
  const [setStockItem, setSetStockItem] = useState<InventoryRecord | null>(
    null,
  );
  const [historyItem, setHistoryItem] = useState<InventoryRecord | null>(null);

  // Debounce search input with useEffect + cleanup (no window hacks)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (inputValue) next.set("search", inputValue);
        else next.delete("search");
        next.set("page", "1");
        return next;
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [inputValue, setSearchParams]);

  const setLocation = useCallback(
    (loc: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (loc) next.set("location", loc);
        else next.delete("location");
        next.set("page", "1");
        return next;
      });
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (p: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("page", String(p));
        return next;
      });
    },
    [setSearchParams],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["inventory", { search, location: locationFilter, page }],
    queryFn: () =>
      getInventory({ search, location: locationFilter || undefined, page }),
  });

  const { data: settingsData } = useQuery({
    queryKey: ["inventory-settings"],
    queryFn: getInventorySettings,
  });

  const { data: locationsData } = useQuery({
    queryKey: ["locations"],
    queryFn: getLocations,
  });

  const threshold = settingsData?.data?.low_stock_threshold ?? 10;
  const items: InventoryRecord[] = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 1;
  const locations: Location[] = locationsData?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Inventory</h1>
          <p className="mt-1 text-sm text-fg/60">
            Track stock levels across all locations.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5 self-start"
          onClick={() => navigate("/inventory/settings")}
        >
          Settings
        </Button>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
            <Input
              placeholder="Search products..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="pl-9"
            />
          </div>

          {locations.length > 0 && (
            <select
              value={locationFilter}
              onChange={(e) => setLocation(e.target.value)}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-bg"
            >
              <option value="">All locations</option>
              {locations.map((loc) => (
                <option key={loc._id} value={loc._id}>
                  {loc.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-fg/50">
              Loading inventory...
            </div>
          ) : items.length === 0 ? (
            <InventoryEmptyState search={search} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-2/40">
                  {["Product", "Variant", "Location", "Stock", ""].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-fg/50 ${
                        h === "" ? "text-right" : "text-left"
                      } first:px-5 last:px-5`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <InventoryRow
                    key={item._id}
                    item={item}
                    threshold={threshold}
                    onAdjust={() => setAdjustItem(item)}
                    onSet={() => setSetStockItem(item)}
                    onHistory={() => setHistoryItem(item)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <div className="text-xs text-fg/50">
              {total} record{total !== 1 ? "s" : ""} — Page {page} of{" "}
              {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {adjustItem && (
        <AdjustStockDialog
          item={adjustItem}
          onClose={() => setAdjustItem(null)}
        />
      )}
      {setStockItem && (
        <SetStockDialogFull
          item={setStockItem}
          onClose={() => setSetStockItem(null)}
        />
      )}
      {historyItem && (
        <HistoryDrawer
          item={historyItem}
          onClose={() => setHistoryItem(null)}
        />
      )}
    </div>
  );
}
