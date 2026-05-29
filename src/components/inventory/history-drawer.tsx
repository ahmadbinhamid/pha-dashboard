import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { getInventoryHistory } from "@/lib/api/inventory";
import type {
  InventoryRecord,
  InventoryHistoryRecord,
} from "@/types/inventory";
import { X } from "lucide-react";

interface HistoryDrawerProps {
  item: InventoryRecord;
  onClose: () => void;
}

export function HistoryDrawer({ item, onClose }: HistoryDrawerProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["inventory-history", item._id],
    queryFn: () => getInventoryHistory(item._id),
  });
  const history: InventoryHistoryRecord[] = data?.data ?? [];

  const productName =
    typeof item.product === "object" ? item.product.title : "Product";

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-dvh w-[min(100vw,520px)] flex-col border-l border-border bg-bg shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-sm font-semibold">Stock History</div>
            <div className="mt-0.5 text-xs text-fg/50">
              {productName}
              {item.variant?.display_name
                ? ` — ${item.variant.display_name}`
                : ""}{" "}
              @ {item.location?.name}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-fg/40 hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-fg/50">
              Loading history...
            </div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-sm text-fg/50">
              No history yet
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((record) => (
                <HistoryRecord key={record._id} record={record} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryRecord({ record }: { record: InventoryHistoryRecord }) {
  return (
    <div className="rounded-lg border border-border bg-bg-2/40 p-3">
      <div className="flex items-center justify-between">
        <span
          className={`text-sm font-semibold ${
            record.adjustment > 0 ? "text-ok" : "text-danger"
          }`}
        >
          {record.adjustment > 0 ? "+" : ""}
          {record.adjustment}
        </span>
        <Badge variant="muted" className="text-[10px]">
          {record.type}
        </Badge>
      </div>
      <div className="mt-1 text-xs text-fg/50">
        {record.stock_before} → {record.stock_after}
      </div>
      {record.reason && (
        <div className="mt-1 text-xs text-fg/60">{record.reason}</div>
      )}
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-fg/40">
        <span>
          {record.user
            ? `${record.user.first_name} ${record.user.last_name}`
            : "System"}
        </span>
        <span>{new Date(record.created_at).toLocaleString()}</span>
      </div>
    </div>
  );
}
