import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardSectionLabel } from "@/components/dashboard/DashboardSectionLabel";
import { RecordReorderModal } from "@/components/dashboard/RecordReorderModal";
import type { CriticalStockItem } from "@/types/dashboard";

export function CriticalStockCard({ items, loading }: { items: CriticalStockItem[]; loading?: boolean }) {
  const navigate = useNavigate();
  const [reorderTarget, setReorderTarget] = useState<CriticalStockItem | null>(null);

  return (
    <Card className="flex h-full min-w-0 flex-col p-3 shadow-card transition-shadow duration-300 hover:shadow-md sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-y-1.5 border-b border-border pb-1.5">
        <DashboardSectionLabel badge={`${items.length} Urgent`} badgeVariant="danger">
          Low Stock Alert
        </DashboardSectionLabel>
        <button
          type="button"
          onClick={() => navigate("/inventory")}
          className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent transition hover:text-accent/80"
        >
          View inventory
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <CardContent className="flex-1 px-0 pt-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-sm text-fg/45">
            <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-fg/25" />
            Nothing below your low-stock threshold right now.
          </div>
        ) : (
          // No sticky first column: only 3 narrow columns, so it would just add weight.
          <div className="max-h-80 overflow-x-auto">
            {/* text-xs overrides Table.tsx default text-sm for compact rows. */}
            <Table className="text-xs">
              <TableHeader className="bg-transparent">
                <TableRow className="hover:bg-transparent">
                  {/* first:/last: px-0 needed to override base first:pl-5/last:pr-5. */}
                  <TableHead className="h-auto px-0 pb-1.5 first:pl-0">
                    Part &amp; SKU
                  </TableHead>
                  <TableHead className="h-auto px-0 pb-1.5 text-center">
                    Available Stock
                  </TableHead>
                  <TableHead className="h-auto px-0 pb-1.5 last:pr-0 text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.inventoryId} className="group cursor-pointer">
                    <TableCell className="px-0 py-2 first:pl-0">
                      <div className="truncate font-semibold text-fg group-hover:text-accent">{item.name}</div>
                      <div className="truncate font-mono text-2xs text-fg/40">{item.sku}</div>
                    </TableCell>
                    <TableCell className="px-0 py-2 text-center">
                      <Badge variant={item.stockCount === 0 ? "danger" : "warn"}>{item.stockCount} units</Badge>
                    </TableCell>
                    <TableCell className="px-0 py-2 text-right last:pr-0">
                      <Button variant="primary" size="sm" onClick={() => setReorderTarget(item)}>
                        Reorder
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <RecordReorderModal item={reorderTarget} onOpenChange={(open) => !open && setReorderTarget(null)} />
    </Card>
  );
}
