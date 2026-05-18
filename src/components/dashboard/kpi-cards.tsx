import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KPIS } from "@/lib/data/dashboard";
import { formatCompactNumber } from "@/lib/format";

export function KpiCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {KPIS.map((kpi) => (
        <Card key={kpi.label}>
          <CardContent className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-fg/55">{kpi.label}</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">{formatCompactNumber(kpi.value)}</div>
            </div>
            <Badge variant={kpi.tone}>{kpi.delta}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
