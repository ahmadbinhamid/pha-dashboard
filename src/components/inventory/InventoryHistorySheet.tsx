import { useQuery } from "@tanstack/react-query";
import { ArrowUp, ArrowDown, SlidersHorizontal, History } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetTitle, SheetDescription } from "@/components/ui/Sheet";
import { getInventoryHistory } from "@/lib/api/inventory";
import type { InventoryRecord, InventoryHistoryRecord } from "@/types/inventory";

interface InventoryHistorySheetProps {
  item: InventoryRecord | null;
  onOpenChange: (open: boolean) => void;
}

function formatAdjustType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function HistoryRow({ entry }: { entry: InventoryHistoryRecord }) {
  const isPositive = entry.adjustment > 0;
  const isZero = entry.adjustment === 0;

  return (
    <div className="flex items-start gap-3 border-b border-border py-3 last:border-0">
      <div
        className={
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md " +
          (isZero ? "bg-bg-2" : isPositive ? "bg-ok/10" : "bg-danger/10")
        }
      >
        {isZero ? (
          <SlidersHorizontal className="h-4 w-4 text-fg/40" />
        ) : isPositive ? (
          <ArrowUp className="h-4 w-4 text-ok" />
        ) : (
          <ArrowDown className="h-4 w-4 text-danger" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-fg">{formatAdjustType(entry.type)}</span>
          <span
            className={
              "text-sm font-semibold tabular-nums " +
              (isZero ? "text-fg/55" : isPositive ? "text-ok" : "text-danger")
            }
          >
            {isPositive ? "+" : ""}
            {entry.adjustment}
          </span>
        </div>

        <p className="mt-0.5 text-xs text-fg/50">
          {entry.stock_before} → {entry.stock_after}
        </p>

        {entry.reason && <p className="mt-0.5 truncate text-xs text-fg/45">{entry.reason}</p>}

        <div className="mt-1 flex items-center justify-between text-[10px] text-fg/35">
          <span>{entry.user ? `${entry.user.first_name} ${entry.user.last_name}` : "System"}</span>
          <span>{formatDateTime(entry.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

export function InventoryHistorySheet({ item, onOpenChange }: InventoryHistorySheetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["inventory-history", item?._id],
    queryFn: () => getInventoryHistory(item!._id),
    enabled: !!item,
    // An audit log must always reflect the latest state when opened — the
    // app-wide 5-minute staleTime (AppProviders.tsx) would otherwise show a
    // stale list if this same item's history was viewed recently, even
    // though a stock change may have happened in between.
    staleTime: 0,
    refetchOnMount: "always",
  });
  const entries = data?.data ?? [];

  const description = item
    ? [item.product?.title, item.variant?.display_name, item.location?.name].filter(Boolean).join(" · ")
    : undefined;

  return (
    <Sheet open={!!item} onOpenChange={onOpenChange}>
      {item && (
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Stock History</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>

          <SheetBody>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 border-b border-border py-3">
                    <div className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-bg-2" />
                    <div className="flex-1 space-y-1.5">
                      <div className="flex justify-between">
                        <div className="h-3.5 w-20 animate-pulse rounded-xs bg-bg-2" />
                        <div className="h-3.5 w-10 animate-pulse rounded-xs bg-bg-2" />
                      </div>
                      <div className="h-3 w-24 animate-pulse rounded-xs bg-bg-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <History className="h-6 w-6 text-fg/25" />
                <p className="text-sm text-fg/45">No stock changes recorded yet.</p>
              </div>
            ) : (
              <div>
                {entries.map((entry) => (
                  <HistoryRow key={entry._id} entry={entry} />
                ))}
              </div>
            )}
          </SheetBody>
        </SheetContent>
      )}
    </Sheet>
  );
}
