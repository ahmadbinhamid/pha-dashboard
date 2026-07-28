import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { ManageColumns } from "@/components/ui/ManageColumns";
import { Table, TableHeader, TableRow, TableHead, TableBody } from "@/components/ui/Table";
import { InventoryRow } from "@/components/inventory/InventoryRow";
import { AdjustStockDialog } from "@/components/inventory/AdjustStockDialog";
import { SetStockDialogFull } from "@/components/inventory/SetStockDialog";
import { InventoryHistorySheet } from "@/components/inventory/InventoryHistorySheet";
import { InventorySettingsModal } from "@/components/inventory/InventorySettingsModal";
import { getInventory, getInventorySettings } from "@/lib/api/inventory";
import { useColumnVisibility, type ColumnDef } from "@/hooks/useColumnVisibility";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import type { InventoryRecord } from "@/types/inventory";
import { Search, Boxes, Settings } from "lucide-react";

// Product (sticky) and Actions are structural, not part of this list — every
// other column can be hidden via "Manage Columns", persisted per browser.
const INVENTORY_COLUMNS: ColumnDef[] = [
  { key: "location", label: "Location", alwaysVisible: true },
  { key: "stock", label: "Stock", alwaysVisible: true },
  { key: "status", label: "Status" },
  { key: "lastUpdated", label: "Last Updated" },
  { key: "dateAdded", label: "Date Added" },
];

export default function InventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { visibility, toggleColumn, isVisible } = useColumnVisibility("inventory", INVENTORY_COLUMNS);

  const search = searchParams.get("search") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10);

  const [inputValue, setInputValue] = useState(search);
  const [adjustTarget, setAdjustTarget] = useState<InventoryRecord | null>(null);
  const [setStockTarget, setSetStockTarget] = useState<InventoryRecord | null>(null);
  const [historyTarget, setHistoryTarget] = useState<InventoryRecord | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchParams((prev) => {
        const current = prev.get("search") ?? "";
        if (inputValue === current) return prev;
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

  const setLimit = useCallback(
    (l: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("limit", String(l));
        next.set("page", "1");
        return next;
      });
    },
    [setSearchParams],
  );

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["inventory", { search, page, limit }],
    queryFn: () => getInventory({ search, page, limit }),
  });

  const { data: settingsRes } = useQuery({
    queryKey: ["inventory-settings"],
    queryFn: getInventorySettings,
    staleTime: 60_000,
  });
  const lowStockThreshold = settingsRes?.data?.low_stock_threshold ?? 10;

  const records: InventoryRecord[] = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Inventory ({total})</h1>
        <Button variant="secondary" size="md" className="gap-2" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </div>

      <Card>
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
              <Input
                placeholder="Search inventory…"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isFetching && !isLoading && <span className="text-xs text-fg/40">Updating…</span>}
            <ManageColumns columns={INVENTORY_COLUMNS} visibility={visibility} onToggle={toggleColumn} />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : records.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-200">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-2 min-w-56 sticky-col-header sticky-col-separator-right">
                    Product
                  </TableHead>
                  {isVisible("location") && <TableHead>Location</TableHead>}
                  {isVisible("stock") && <TableHead className="text-right">Stock</TableHead>}
                  {isVisible("status") && <TableHead>Status</TableHead>}
                  {isVisible("lastUpdated") && <TableHead>Last Updated</TableHead>}
                  {isVisible("dateAdded") && <TableHead>Date Added</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <InventoryRow
                    key={record._id}
                    record={record}
                    lowStockThreshold={lowStockThreshold}
                    isVisible={isVisible}
                    onAdjust={() => setAdjustTarget(record)}
                    onSetStock={() => setSetStockTarget(record)}
                    onViewHistory={() => setHistoryTarget(record)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          itemsPerPage={limit}
          onLimitChange={setLimit}
          isLoading={isFetching}
          onPageChange={setPage}
        />
      </Card>

      <AdjustStockDialog item={adjustTarget} onOpenChange={(open) => !open && setAdjustTarget(null)} />

      <SetStockDialogFull
        item={setStockTarget}
        onOpenChange={(open) => {
          if (!open) {
            setSetStockTarget(null);
            refetch();
          }
        }}
      />

      <InventoryHistorySheet item={historyTarget} onOpenChange={(open) => !open && setHistoryTarget(null)} />

      <InventorySettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

const SKEL_WIDTHS = [140, 180, 120, 160, 130];

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-border">
      {SKEL_WIDTHS.map((w, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <div className="flex-1 space-y-2">
            <div className="h-3.5 animate-pulse rounded-xs bg-bg-2" style={{ width: w }} />
            <div className="h-3 w-16 animate-pulse rounded-xs bg-bg-2" />
          </div>
          <div className="h-5 w-24 animate-pulse rounded-xs bg-bg-2" />
          <div className="h-5 w-10 animate-pulse rounded-xs bg-bg-2" />
          <div className="h-5 w-20 animate-pulse rounded-xs bg-bg-2" />
          <div className="h-7 w-7 animate-pulse rounded-xs bg-bg-2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-xs border border-border bg-bg-2">
        <Boxes className="h-8 w-8 text-fg/30" />
      </div>
      <div>
        <p className="font-medium text-fg">{search ? "No inventory found" : "No inventory yet"}</p>
        <p className="mt-1 text-sm text-fg/50">
          {search
            ? `No results for "${search}" — try a different term`
            : "Stock records appear here once products start tracking inventory"}
        </p>
      </div>
    </div>
  );
}
