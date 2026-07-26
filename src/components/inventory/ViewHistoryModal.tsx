import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/Modal";
import { getInventoryHistory } from "@/lib/api/inventory";
import type { InventoryRecord } from "@/types/inventory";
import { History } from "lucide-react";

interface ViewHistoryModalProps {
  item: InventoryRecord | null;
  onOpenChange: (open: boolean) => void;
}

const ADJUST_TYPE_LABEL: Record<string, string> = {
  restock: "Restock",
  correction: "Correction",
  damaged: "Damaged",
  lost: "Lost",
  stolen: "Stolen",
  transfer_in: "Transfer In",
  transfer_out: "Transfer Out",
  other: "Other",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ViewHistoryModal({ item, onOpenChange }: ViewHistoryModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["inventory-history", item?._id],
    queryFn: () => getInventoryHistory(item!._id),
    enabled: !!item,
  });
  const entries = data?.data ?? [];

  return (
    <Modal open={!!item} onOpenChange={onOpenChange}>
      {item && (
        <ModalContent className="max-w-lg">
          <ModalHeader>
            <ModalTitle>Stock History</ModalTitle>
            <ModalDescription>
              {item.product?.title}
              {item.variant?.display_name ? ` — ${item.variant.display_name}` : ""} @ {item.location?.name}
            </ModalDescription>
          </ModalHeader>

          <div className="max-h-96 space-y-2 overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xs bg-bg-2" />
              ))
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <History className="h-6 w-6 text-fg/25" />
                <p className="text-sm text-fg/45">No stock changes recorded yet.</p>
              </div>
            ) : (
              entries.map((entry) => (
                <div key={entry._id} className="rounded-xs border border-border bg-bg-2/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={
                        entry.adjustment >= 0
                          ? "text-sm font-semibold tabular-nums text-ok"
                          : "text-sm font-semibold tabular-nums text-danger"
                      }
                    >
                      {entry.adjustment >= 0 ? "+" : ""}
                      {entry.adjustment}
                    </span>
                    <Badge variant="outline">{ADJUST_TYPE_LABEL[entry.type] ?? entry.type}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-fg/55">
                    {entry.stock_before} → {entry.stock_after} units
                  </p>
                  {entry.reason && <p className="mt-1 text-xs text-fg/45">{entry.reason}</p>}
                  <div className="mt-2 flex items-center justify-between text-[10px] text-fg/35">
                    <span>{entry.user ? `${entry.user.first_name} ${entry.user.last_name}` : "System"}</span>
                    <span>{formatDateTime(entry.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </ModalContent>
      )}
    </Modal>
  );
}
