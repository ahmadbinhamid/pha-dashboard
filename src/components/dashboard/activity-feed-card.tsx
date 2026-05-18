import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ACTIVITY } from "@/lib/data/dashboard";

export function ActivityFeedCard() {
  return (
    <Card>
      <CardHeader title="Activity" description="Operational events and sync status." />
      <CardContent className="space-y-3">
        {ACTIVITY.map((a, idx) => (
          <div key={idx} className="flex gap-3">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent/80" />
            <div className="min-w-0">
              <div className="text-sm text-fg/80">{a.text}</div>
              <div className="mt-1 text-xs text-fg/55">{a.at}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

