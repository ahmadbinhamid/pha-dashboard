import { Button } from "@/components/ui/button";
import { StockBadge } from "@/components/inventory/stock-badge";
import type { InventoryRecord } from "@/types/inventory";
import { Package, History } from "lucide-react";

interface InventoryRowProps {
  item: InventoryRecord;
  threshold: number;
  onAdjust: () => void;
  onSet: () => void;
  onHistory: () => void;
}

export function InventoryRow({
  item,
  threshold,
  onAdjust,
  onSet,
  onHistory,
}: InventoryRowProps) {
  const productName =
    typeof item.product === "object" ? item.product.title : "Unknown";
  const coverUrl =
    typeof item.product === "object"
      ? item.product.attachments?.[0]?.url
      : null;

  return (
    <tr className="hover:bg-bg-2/30">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-border bg-bg-2">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={productName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-4 w-4 text-fg/25" />
              </div>
            )}
          </div>
          <span className="truncate font-medium">{productName}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-fg/60">
        {item.variant?.display_name ?? <span className="text-fg/30">—</span>}
      </td>
      <td className="px-4 py-3 text-fg/70">{item.location?.name ?? "—"}</td>
      <td className="px-4 py-3">
        <StockBadge item={item} threshold={threshold} />
      </td>
      <td className="px-5 py-3">
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onAdjust}
          >
            Adjust
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onSet}
          >
            Set
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="View history"
            onClick={onHistory}
          >
            <History className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

interface InventoryEmptyStateProps {
  search: string;
}

export function InventoryEmptyState({ search }: InventoryEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-2">
        <Package className="h-7 w-7 text-fg/30" />
      </div>
      <div>
        <div className="text-sm font-medium">No inventory records</div>
        <div className="mt-1 text-xs text-fg/50">
          {search
            ? "Try a different search term"
            : "Create products and enable stock tracking to see inventory here"}
        </div>
      </div>
    </div>
  );
}
