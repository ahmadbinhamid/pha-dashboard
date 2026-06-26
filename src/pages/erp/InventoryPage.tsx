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
import type { InventoryRecord } from "@/types/inventory";
import { Pagination } from "@/components/ui/pagination";
import { Search } from "lucide-react";

export default function InventoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1", 10);

  const [inputValue, setInputValue] = useState(search);
  const [adjustItem, setAdjustItem] = useState<InventoryRecord | null>(null);
  const [setStockItem, setSetStockItem] = useState<InventoryRecord | null>(
    null,
  );
  const [historyItem, setHistoryItem] = useState<InventoryRecord | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchParams((prev) => {
        const current = prev.get("search") ?? "";
        if (inputValue === current) return prev; // no change — don't reset page
        const next = new URLSearchParams(prev);
        if (inputValue) next.set("search", inputValue);
        else next.delete("search");
        next.set("page", "1");
        return next;
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [inputValue, setSearchParams]);

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
    queryKey: ["inventory", { search, page }],
    queryFn: () => getInventory({ search, page }),
  });

  const { data: settingsData } = useQuery({
    queryKey: ["inventory-settings"],
    queryFn: getInventorySettings,
  });

  const threshold = settingsData?.data?.low_stock_threshold ?? 10;
  const items: InventoryRecord[] = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 1;

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

        </div>

        <div className="w-full overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-fg/50">
              Loading inventory...
            </div>
          ) : items.length === 0 ? (
            <InventoryEmptyState search={search} />
          ) : (
            <table className="w-full min-w-160 text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-2/40">
                  {["Product", "Variant", "Location", "Stock", "Actions"].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-fg/50 ${
                        h === "Actions" ? "text-right" : "text-left"
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

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          onPageChange={setPage}
        />
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
