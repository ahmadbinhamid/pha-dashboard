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
    <Card className="@container flex h-full flex-col p-5 shadow-card transition-shadow duration-300 hover:shadow-md">
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
            {/* Column weights answer two things at once. The share column
                holds a 48px bar, a gap and "100.0%" — about 96px — which does
                not fit 3/12 of this card and, being justify-end, overflowed
                LEFT across the revenue figure; it gets 4/12 once the bar is
                actually shown. Below that the bar is gone, so those columns go
                back to the revenue figure instead: a truncated category name
                is a nuisance, a truncated dollar amount is a misread.

                The switch is @xs (20rem of card content), not @sm: bar + gap +
                "100.0%" needs ~94px, which 4/12 already covers at 320px of
                content, and this card is only ~350px wide in its own row — a
                higher threshold hid the bars on every real screen. */}
            <div className="grid grid-cols-12 pb-1.5 text-[10px] font-semibold uppercase text-fg/35">
              <span className="col-span-4">Category</span>
              <span className="col-span-5 text-right @xs:col-span-4">Revenue</span>
              <span className="col-span-3 text-right @xs:col-span-4">% of Total</span>
            </div>
            {rows.map((row) => (
              <div key={row.categoryId ?? "uncategorized"} className="grid grid-cols-12 items-center pt-2.5">
                <span className="col-span-4 truncate font-semibold text-fg">{row.name}</span>
                <span className="col-span-5 truncate text-right font-bold text-fg tabular-nums @xs:col-span-4">
                  {formatCurrencyFromCents(row.revenueCents)}
                </span>
                <div className="col-span-3 flex min-w-0 items-center justify-end gap-2 @xs:col-span-4">
                  {/* Gated on the CARD's width, not the viewport's. This card
                      is ~1/3 of a row, so a wide screen says nothing about
                      whether there's room here — the old `sm:block` is what
                      let the bar appear in a card too narrow to hold it. */}
                  <div className="hidden h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-muted @xs:block @sm:w-12">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(row.pct, 100)}%` }} />
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-fg/60 tabular-nums">{row.pct.toFixed(1)}%</span>
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
