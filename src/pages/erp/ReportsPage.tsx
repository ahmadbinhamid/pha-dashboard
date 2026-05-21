import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-fg/70">Operational and financial reporting exports.</p>
      </div>

      <Card>
        <CardHeader title="Reports" description="UI placeholder for report builder + exports." />
        <CardContent>
          <EmptyState
            title="No reports yet"
            description="Create your first report once data sources are connected."
            actionLabel="Open Analytics"
            actionHref="/analytics"
          />
        </CardContent>
      </Card>
    </div>
  );
}
