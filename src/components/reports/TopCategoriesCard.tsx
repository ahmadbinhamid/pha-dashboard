import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardSectionLabel } from "@/components/dashboard/DashboardSectionLabel";
import { formatCurrencyFromCents } from "@/utils/format";
import type { TopCategoryRow } from "@/types/reports";

export function TopCategoriesCard({ rows, loading }: { rows: TopCategoryRow[]; loading?: boolean }) {
  const navigate = useNavigate();

  return (
    <Card className="flex h-full flex-col p-5 shadow-card transition-shadow duration-300 hover:shadow-md">
      <DashboardSectionLabel>Top Categories by Revenue</DashboardSectionLabel>

      <CardContent className="flex-1 px-0 pt-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-fg/45">No orders in this range yet</div>
        ) : (
          <div className="divide-y divide-border text-xs">
            <div className="grid grid-cols-12 pb-1.5 text-[10px] font-semibold uppercase text-fg/35">
              <span className="col-span-5">Category</span>
              <span className="col-span-4 text-right">Revenue</span>
              <span className="col-span-3 text-right">% of Total</span>
            </div>
            {rows.map((row) => (
              <div key={row.categoryId ?? "uncategorized"} className="grid grid-cols-12 items-center pt-2.5">
                <span className="col-span-5 truncate font-semibold text-fg">{row.name}</span>
                <span className="col-span-4 text-right font-bold text-fg">{formatCurrencyFromCents(row.revenueCents)}</span>
                <div className="col-span-3 flex items-center justify-end gap-2">
                  <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-muted sm:block">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(row.pct, 100)}%` }} />
                  </div>
                  <span className="text-[11px] font-semibold text-fg/60">{row.pct.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/categories")}>
        View All Categories
      </Button>
    </Card>
  );
}
