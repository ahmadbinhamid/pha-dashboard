
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/utils/format";

const REVENUE = [
  { label: "Jan", value: 81200 },
  { label: "Feb", value: 76340 },
  { label: "Mar", value: 90510 },
  { label: "Apr", value: 104200 },
  { label: "May", value: 98550 },
];

function Bars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="grid grid-cols-5 gap-2">
      {values.map((v, i) => (
        <div key={i} className="flex flex-col justify-end gap-2">
          <div
            className="rounded-lg bg-accent/20 ring-1 ring-inset ring-border"
            style={{ height: `${Math.max(10, (v / max) * 140)}px` }}
          />
        </div>
      ))}
    </div>
  );
}

export function AnalyticsView() {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const total = useMemo(() => REVENUE.reduce((a, b) => a + b.value, 0), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline">Range</Badge>
          <div className="flex items-center gap-2">
            {(["7d", "30d", "90d"] as const).map((r) => (
              <Button
                key={r}
                variant={range === r ? "primary" : "secondary"}
                size="sm"
                onClick={() => setRange(r)}
              >
                {r.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
        <Button variant="secondary" size="sm">
          Download
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Revenue"
            description="Gross revenue trend (dummy data)."
            right={<Badge variant="ok">+12.4%</Badge>}
          />
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-fg/55">
                  Total ({range.toUpperCase()})
                </div>
                <div className="mt-1 text-2xl font-semibold tracking-tight">
                  {formatCurrency(total)}
                </div>
              </div>
              <div className="text-xs text-fg/60">Updated just now</div>
            </div>
            <div className="rounded-xl border border-border bg-bg px-4 py-4">
              <Bars values={REVENUE.map((r) => r.value)} />
              <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs text-fg/60">
                {REVENUE.map((r) => (
                  <div key={r.label}>{r.label}</div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Top sellers" description="Best performing SKUs." />
            <CardContent className="space-y-3">
              {[
                { sku: "PPG-SP-9007", name: "Spark Plug (Iridium)", v: 482 },
                { sku: "PPG-BPS-1042", name: "Brake Pad Set", v: 217 },
                { sku: "PPG-OF-2201", name: "Oil Filter", v: 188 },
              ].map((p) => (
                <div key={p.sku} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="truncate text-xs text-fg/60">{p.sku}</div>
                  </div>
                  <Badge variant="outline">{p.v} sold</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Inventory movement" description="Net stock change (sample)." />
            <CardContent className="space-y-3">
              {[
                { label: "Inbound", v: "+320", tone: "ok" as const },
                { label: "Outbound", v: "-274", tone: "warn" as const },
                { label: "Adjustments", v: "+12", tone: "muted" as const },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between">
                  <div className="text-sm text-fg/75">{r.label}</div>
                  <Badge variant={r.tone}>{r.v}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

