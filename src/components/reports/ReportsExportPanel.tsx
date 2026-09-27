import { Download, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardSectionLabel } from "@/components/dashboard/DashboardSectionLabel";
import { downloadPdf } from "@/utils/pdf";
import { PERMISSIONS } from "@/config/permissions";
import { useMyAccess } from "@/hooks/useMyAccess";

// No report storage, so each row builds a real PDF from on-page data.
export interface ExportDataset {
  id: string;
  title: string;
  rows: Record<string, unknown>[];
  // Coverage label; defaults to date range, stock datasets pass their own.
  scopeLabel?: string;
}

export function ReportsExportPanel({ datasets, loading }: { datasets: ExportDataset[]; loading?: boolean }) {
  const canExport = useMyAccess().can(PERMISSIONS.reports.export);
  return (
    <Card className="flex h-full flex-col p-5 shadow-card transition-shadow duration-300 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <DashboardSectionLabel>Export Reports</DashboardSectionLabel>
        {canExport && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={datasets.every((d) => d.rows.length === 0)}
            onClick={() =>
              datasets.forEach(
                (d) => d.rows.length > 0 && downloadPdf(d.title.toLowerCase().replace(/\s+/g, "_"), d.rows, { title: d.title }),
              )
            }
          >
            Export All
          </Button>
        )}
      </div>

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
                    <p className="truncate text-3xs text-fg/40">
                      {dataset.rows.length} {dataset.rows.length === 1 ? "row" : "rows"}{" "}
                      {dataset.scopeLabel ?? "for the selected range"}
                    </p>
                  </div>
                </div>

                {canExport && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-auto shrink-0 gap-1 px-2.5 py-1 text-2xs"
                    disabled={dataset.rows.length === 0}
                    onClick={() => downloadPdf(dataset.title.toLowerCase().replace(/\s+/g, "_"), dataset.rows, { title: dataset.title })}
                  >
                    PDF
                    <Download className="h-3 w-3 text-fg/50" />
                  </Button>
                )}
              </div>
            ))}
      </CardContent>

    </Card>
  );
}
