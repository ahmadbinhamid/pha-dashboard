import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SALES_SERIES } from "@/lib/data/dashboard";
import { formatCurrency } from "@/utils/format";

function SparkArea({
  values,
}: {
  values: number[];
}) {
  const w = 640;
  const h = 220;
  const pad = 18;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sx = (i: number) => pad + (i * (w - pad * 2)) / (values.length - 1);
  const sy = (v: number) => {
    const t = (v - min) / Math.max(1, max - min);
    return pad + (1 - t) * (h - pad * 2);
  };
  const line = values
    .map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`)
    .join(" ");
  const area = `${pad},${h - pad} ` + line + ` ${w - pad},${h - pad}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[min(220px,55vw)] w-full min-w-0 max-w-full sm:h-[220px]" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="salesChartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(var(--accent))" stopOpacity="0.28" />
          <stop offset="1" stopColor="hsl(var(--accent))" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={`M ${area}`} fill="url(#salesChartFill)" />
      <polyline
        points={line}
        fill="none"
        stroke="hsl(var(--accent))"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SalesChartCard() {
  const total = SALES_SERIES.reduce((acc, p) => acc + p.value, 0);
  const last = SALES_SERIES.at(-1)?.value ?? 0;
  const first = SALES_SERIES.at(0)?.value ?? 1;
  const delta = ((last - first) / first) * 100;

  return (
    <Card>
      <CardHeader
        title="Sales (Last 7 days)"
        description="Gross revenue across Shopify, eBay, and wholesale."
        right={<Badge variant={delta >= 0 ? "ok" : "danger"}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}%</Badge>}
      />
      <CardContent className="min-w-0 space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-fg/55">
              Total
            </div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">{formatCurrency(total)}</div>
          </div>
          <div className="hidden sm:flex gap-5 text-xs text-fg/60">
            {SALES_SERIES.map((p) => (
              <div key={p.day} className="text-center">
                <div className="font-semibold text-fg/75">{p.day}</div>
                <div>{formatCurrency(p.value)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-bg">
          <SparkArea values={SALES_SERIES.map((p) => p.value)} />
        </div>
      </CardContent>
    </Card>
  );
}

