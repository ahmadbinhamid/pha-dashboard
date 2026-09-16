import { useNavigate } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardSectionLabel } from "@/components/dashboard/DashboardSectionLabel";
import { ORDER_CHANNEL_LABEL } from "@/components/orders/OrderChannelBadge";
import { formatCurrencyFromCents } from "@/utils/format";
import type { OrderChannel } from "@/types/orders";
import type { RevenueByChannelRow } from "@/types/reports";

const CHANNEL_COLOR_VARS = [
  "var(--color-cat-1)",
  "var(--color-cat-2)",
  "var(--color-cat-3)",
  "var(--color-cat-4)",
  "var(--color-cat-5)",
  "var(--color-cat-6)",
];

function channelLabel(key: string) {
  return ORDER_CHANNEL_LABEL[key as OrderChannel] ?? key;
}

export function RevenueByChannelCard({ rows, loading }: { rows: RevenueByChannelRow[]; loading?: boolean }) {
  const navigate = useNavigate();
  const totalCents = rows.reduce((sum, r) => sum + r.revenueCents, 0);

  return (
    <Card className="flex h-full flex-col p-5 shadow-card transition-shadow duration-300 hover:shadow-md">
      <DashboardSectionLabel>Revenue by Channel</DashboardSectionLabel>

      <CardContent className="flex-1 space-y-4 px-0 pt-4">
        {loading ? (
          <Skeleton className="mx-auto h-44 w-44 rounded-full" />
        ) : rows.length === 0 ? (
          <div className="flex h-44 items-center justify-center text-sm text-fg/45">No orders in this range yet</div>
        ) : (
          <div className="relative h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rows} dataKey="revenueCents" innerRadius={55} outerRadius={75} paddingAngle={3}>
                  {rows.map((row, i) => (
                    <Cell key={row.channel} fill={CHANNEL_COLOR_VARS[i % CHANNEL_COLOR_VARS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-medium uppercase text-fg/40">Total Revenue</span>
              <span className="text-sm font-bold text-fg">{formatCurrencyFromCents(totalCents)}</span>
            </div>
          </div>
        )}

        <div className="space-y-2 text-xs">
          {(loading ? [] : rows).map((row, i) => (
            <div key={row.channel} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: CHANNEL_COLOR_VARS[i % CHANNEL_COLOR_VARS.length] }}
                  aria-hidden="true"
                />
                <span className="font-medium text-fg/75">{channelLabel(row.channel)}</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-fg">{row.pct.toFixed(1)}%</span>
                <span className="block text-[11px] text-fg/40">{formatCurrencyFromCents(row.revenueCents)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/catalogue?tab=listings")}>
        View Channel Performance
      </Button>
    </Card>
  );
}
