import { Download, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardSectionLabel } from "@/components/dashboard/DashboardSectionLabel";
import { downloadCsv } from "@/utils/csv";

// Real-data replacement for the reference mockup's "Recent Reports" panel
// (a list of pre-generated PDFs with fixed timestamps) — this app has no
// report-generation/storage feature, so instead of faking that history,
// each row downloads a real CSV of data already loaded on the page.
export interface ExportDataset {
  id: string;
  title: string;
  rows: Record<string, unknown>[];
}

export function ReportsExportPanel({ datasets, loading }: { datasets: ExportDataset[]; loading?: boolean }) {
  return (
    <Card className="flex h-full flex-col p-5 shadow-card transition-shadow duration-300 hover:shadow-md">
      <DashboardSectionLabel>Export Reports</DashboardSectionLabel>

      <CardContent className="flex-1 space-y-2 divide-y divide-border px-0 pt-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)
          : datasets.map((dataset) => (
              <div key={dataset.id} className="flex items-center justify-between gap-3 pt-2 text-xs first:pt-0">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-fg">{dataset.title}</p>
                    <p className="truncate text-[10px] text-fg/40">{dataset.rows.length} rows for the selected range</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={dataset.rows.length === 0}
                  onClick={() => downloadCsv(dataset.title.toLowerCase().replace(/\s+/g, "_"), dataset.rows)}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-[11px] font-semibold text-fg transition-colors hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span>CSV</span>
                  <Download className="h-3 w-3 text-fg/50" />
                </button>
              </div>
            ))}
      </CardContent>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={datasets.every((d) => d.rows.length === 0)}
        onClick={() => datasets.forEach((d) => d.rows.length > 0 && downloadCsv(d.title.toLowerCase().replace(/\s+/g, "_"), d.rows))}
      >
        Export All
      </Button>
    </Card>
  );
}
