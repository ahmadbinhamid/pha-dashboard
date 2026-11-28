import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailCheck, Pencil, Plus, Trash2 } from "lucide-react";
import { Can } from "@/components/auth/Can";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "@/components/ui/Link";
import { SkeletonText } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { FOLLOW_UPS_BASE_PATH, FOLLOW_UP_CHANNEL_OPTIONS } from "@/config/followups";
import { PERMISSIONS } from "@/config/permissions";
import { useToast } from "@/context";
import { useMyAccess } from "@/hooks/useMyAccess";
import { FOLLOW_UPS_QUERY_KEY, deleteFollowUp, getFollowUps, setFollowUpEnabled } from "@/lib/api/followups";
import { pluralize } from "@/utils/format";
import type { FollowUp } from "@/types/followup";

const CHANNEL_LABEL = Object.fromEntries(FOLLOW_UP_CHANNEL_OPTIONS.map((o) => [o.value, o.label]));

function timing(f: FollowUp) {
  return `${pluralize(f.shipped_delay_days, "day")} after shipping · ${pluralize(f.handover_delay_days, "day")} after pickup or local delivery`;
}

export function FollowUpsPanel() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can } = useMyAccess();
  const [deleting, setDeleting] = useState<FollowUp | null>(null);
  const { data, isLoading } = useQuery({ queryKey: FOLLOW_UPS_QUERY_KEY, queryFn: getFollowUps });
  const followUps = data?.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: FOLLOW_UPS_QUERY_KEY });
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => setFollowUpEnabled(id, enabled),
    onSuccess: (res) => {
      void invalidate();
      toast({ title: res.data.enabled ? "Follow-up switched on" : "Follow-up paused", tone: "success" });
    },
    onError: (err: Error) => toast({ title: "Couldn't change it", description: err.message, tone: "danger" }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFollowUp(id),
    onSuccess: () => {
      void invalidate();
      setDeleting(null);
      toast({ title: "Follow-up deleted", tone: "success" });
    },
    onError: (err: Error) => toast({ title: "Couldn't delete it", description: err.message, tone: "danger" }),
  });

  if (isLoading) return <SkeletonText lines={5} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-fg/60">
          Automatic emails a few days after an order is shipped or collected, asking customers to rate what they bought. Only orders completed after
          you switch one on are emailed. eBay orders are never included.
        </p>
        <Can permission={PERMISSIONS.campaigns.create}>
          <Button variant="primary" className="shrink-0" onClick={() => navigate(`${FOLLOW_UPS_BASE_PATH}/new`)}>
            <Plus className="h-4 w-4" />
            New follow-up
          </Button>
        </Can>
      </div>

      {followUps.length === 0 ? (
        <Card>
          <EmptyState
            icon={MailCheck}
            title="No follow-ups yet"
            description="Start with a product feedback email: it asks customers to rate each item about a week after it ships."
          />
        </Card>
      ) : (
        followUps.map((f) => (
          <Card key={f._id}>
            <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Link href={`${FOLLOW_UPS_BASE_PATH}/${f._id}`} className="font-medium text-fg hover:text-accent">
                  {f.name}
                </Link>
                <div className="mt-0.5 text-xs text-fg/55">{timing(f)}</div>
                <div className="mt-0.5 text-xs text-fg/55">{f.channels.map((c) => CHANNEL_LABEL[c]).join(" · ")}</div>
                <div className="mt-2 text-xs text-fg/70">
                  <span className="font-medium text-fg">{f.sends.sent}</span> sent
                  {f.sends.queued ? ` · ${f.sends.queued} sending` : ""}
                  {f.sends.failed ? ` · ${f.sends.failed} failed` : ""}
                  {f.sends.skipped ? ` · ${f.sends.skipped} skipped (unsubscribed)` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  checked={f.enabled}
                  onCheckedChange={(enabled) => toggle.mutate({ id: f._id, enabled })}
                  disabled={!can(PERMISSIONS.campaigns.send) || toggle.isPending}
                  label={f.enabled ? "On" : "Off"}
                />
                <Button variant="ghost" size="icon" aria-label={`Edit ${f.name}`} onClick={() => navigate(`${FOLLOW_UPS_BASE_PATH}/${f._id}`)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Can permission={PERMISSIONS.campaigns.delete}>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${f.name}`} onClick={() => setDeleting(f)}>
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                </Can>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <ConfirmModal
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this follow-up?"
        description="No more emails go out for it. Feedback already received stays in the Feedback tab."
        confirmLabel="Delete"
        tone="danger"
        confirming={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting._id)}
      />
    </div>
  );
}
