import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, History } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { ActivityEventRow } from "@/components/activity/ActivityEventRow";
import { listActivityLog } from "@/lib/api/dashboard";

// A recent slice of the same audit trail the Activity Log page paginates —
// enough to answer "what changed lately" without leaving Settings, with a
// link across for filtering and history.
const RECENT_LIMIT = 8;

export function ActivityTab() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["activity-log", "settings-recent"],
    queryFn: () => listActivityLog({ page: 1, limit: RECENT_LIMIT }),
  });

  const events = data?.data?.items ?? [];

  return (
    <SettingsSection
      title="Recent Activity"
      description="Every stock movement, order change and settings edit made by your team, newest first."
      right={
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/activity-log")}>
          Full activity log
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xs border border-border bg-bg-2">
            <History className="h-8 w-8 text-fg/30" />
          </div>
          <div>
            <p className="font-medium text-fg">Nothing recorded yet</p>
            <p className="mt-1 text-sm text-fg/50">Activity appears here as your team works.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <ActivityEventRow key={event.id} event={event} showDate />
          ))}
        </div>
      )}
    </SettingsSection>
  );
}
