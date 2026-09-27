import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/Table";
import { DashboardSectionLabel } from "@/components/dashboard/DashboardSectionLabel";
import { ORDER_CHANNEL_LABEL } from "@/components/orders/OrderChannelBadge";
import { downloadPdf } from "@/utils/pdf";
import { formatCurrencyFromCents } from "@/utils/format";
import type { OrderChannel } from "@/types/orders";
import type { SalesPerformanceRow } from "@/types/reports";

function channelLabel(key: string) {
  return ORDER_CHANNEL_LABEL[key as OrderChannel] ?? key;
}

export function SalesPerformanceTable({ rows, loading }: { rows: SalesPerformanceRow[]; loading?: boolean }) {
  return (
    <Card className="flex h-full min-w-0 flex-col p-3 shadow-card transition-shadow duration-300 hover:shadow-md sm:p-4">
      <div className="border-b border-border px-2 pb-2">
        <DashboardSectionLabel>Sales Performance</DashboardSectionLabel>
      </div>

      <CardContent className="flex-1 px-0 pt-3">
        {loading ? (
          <div className="space-y-2 px-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-fg/45">No orders in this range yet</div>
        ) : (
          // No horizontal padding: six columns don't fit Table's default px-4 here.
          <div className="overflow-x-auto">
            <Table className="text-2xs">
              <TableHeader className="bg-transparent">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-auto px-1 pb-2 first:pl-0 text-3xs">Channel</TableHead>
                  <TableHead className="h-auto px-1 pb-2 text-right text-3xs">Revenue</TableHead>
                  <TableHead className="h-auto px-1 pb-2 text-right text-3xs">Orders</TableHead>
                  <TableHead className="h-auto px-1 pb-2 text-right text-3xs">Items</TableHead>
                  <TableHead className="h-auto px-1 pb-2 text-right text-3xs">AOV</TableHead>
                  <TableHead className="h-auto px-1 pb-2 last:pr-0 text-right text-3xs">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.channel}>
                    <TableCell className="px-1 py-2.5 first:pl-0 font-semibold text-fg">{channelLabel(row.channel)}</TableCell>
                    <TableCell className="px-1 py-2.5 text-right font-bold text-fg tabular-nums">{formatCurrencyFromCents(row.revenueCents)}</TableCell>
                    <TableCell className="px-1 py-2.5 text-right text-fg/70 tabular-nums">{row.orders}</TableCell>
                    <TableCell className="px-1 py-2.5 text-right text-fg/70 tabular-nums">{row.itemsSold}</TableCell>
                    <TableCell className="px-1 py-2.5 text-right text-fg/70 tabular-nums">{formatCurrencyFromCents(row.avgOrderValueCents)}</TableCell>
                    <TableCell className="px-1 py-2.5 last:pr-0 text-right">
                      <span className="font-semibold text-ok tabular-nums">{formatCurrencyFromCents(row.grossProfitCents)}</span>
                      {row.trendPct !== null && (
                        <span className={`block text-4xs font-normal ${row.trendPct >= 0 ? "text-ok" : "text-danger"}`}>
                          {row.trendPct >= 0 ? "↗" : "↘"} {Math.abs(row.trendPct).toFixed(1)}%
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() =>
          downloadPdf(
            "sales_performance_by_channel",
            rows.map((r) => ({
              channel: channelLabel(r.channel),
              revenue: (r.revenueCents / 100).toFixed(2),
              orders: r.orders,
              itemsSold: r.itemsSold,
              avgOrderValue: (r.avgOrderValueCents / 100).toFixed(2),
              grossProfit: (r.grossProfitCents / 100).toFixed(2),
            })),
            { title: "Sales Performance by Channel" },
          )
        }
      >
        View Channel Report
      </Button>
    </Card>
  );
}
