import { AnalyticsView } from "@/components/analytics/analytics-view";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-fg/70">
          Revenue, product performance, and inventory movement with date range controls.
        </p>
      </div>

      <AnalyticsView />
    </div>
  );
}
