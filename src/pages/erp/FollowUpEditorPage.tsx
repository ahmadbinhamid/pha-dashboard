import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { BreadcrumbNav } from "@/components/ui/BreadcrumbNav";
import { Button } from "@/components/ui/Button";
import { SkeletonText } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { FollowUpForm } from "@/components/campaigns/FollowUpForm";
import { CAMPAIGNS_BASE_PATH } from "@/config/campaigns";
import { FOLLOW_UPS_BASE_PATH } from "@/config/followups";
import { PERMISSIONS } from "@/config/permissions";
import { useToast } from "@/context";
import { useMyAccess } from "@/hooks/useMyAccess";
import { FOLLOW_UPS_QUERY_KEY, createFollowUp, followUpQueryKey, getFollowUp, setFollowUpEnabled, updateFollowUp } from "@/lib/api/followups";
import type { FollowUpFormValues } from "@/lib/validation/followup";

const FOLLOW_UPS_TAB = `${CAMPAIGNS_BASE_PATH}?tab=follow-ups`;

const toPayload = (v: FollowUpFormValues) => ({ ...v, alert_at_or_below: Number(v.alert_at_or_below) });

// Serves /campaigns/follow-ups/new and /campaigns/follow-ups/:id.
export default function FollowUpEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can } = useMyAccess();

  const { data, isLoading } = useQuery({ queryKey: followUpQueryKey(id ?? ""), queryFn: () => getFollowUp(id!), enabled: !isNew });
  const followUp = data?.data ?? null;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: FOLLOW_UPS_QUERY_KEY });

  const save = useMutation({
    mutationFn: (v: FollowUpFormValues) => (isNew ? createFollowUp(toPayload(v)) : updateFollowUp(id!, toPayload(v))),
    onSuccess: (res) => {
      void invalidate();
      toast({ title: isNew ? "Follow-up created. Switch it on when you're ready." : "Follow-up saved", tone: "success" });
      if (isNew) navigate(`${FOLLOW_UPS_BASE_PATH}/${res.data._id}`, { replace: true });
    },
    onError: (err: Error) => toast({ title: "Couldn't save the follow-up", description: err.message, tone: "danger" }),
  });
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setFollowUpEnabled(id!, enabled),
    onSuccess: (res) => {
      void invalidate();
      toast({
        title: res.data.enabled ? "Switched on" : "Paused",
        description: res.data.enabled ? "Orders completed from now on will get this email." : undefined,
        tone: "success",
      });
    },
    onError: (err: Error) => toast({ title: "Couldn't change it", description: err.message, tone: "danger" }),
  });

  const title = isNew ? "New follow-up" : (followUp?.name ?? "Follow-up");

  return (
    <div className="space-y-6">
      <BreadcrumbNav items={[{ label: "Campaigns", href: CAMPAIGNS_BASE_PATH }, { label: "Follow-ups", href: FOLLOW_UPS_TAB }, { label: title }]} />
      <PageHeader title={title} description={isNew ? "An automatic email after each order, asking how it went." : undefined}>
        {followUp ? (
          <div className="flex items-center gap-2">
            <Badge variant={followUp.enabled ? "ok" : "muted"}>{followUp.enabled ? "On" : "Off"}</Badge>
            {can(PERMISSIONS.campaigns.send) ? (
              <Button variant={followUp.enabled ? "secondary" : "primary"} disabled={toggle.isPending} onClick={() => toggle.mutate(!followUp.enabled)}>
                {followUp.enabled ? "Pause" : "Switch on"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </PageHeader>
      {!isNew && isLoading ? (
        <SkeletonText lines={10} />
      ) : (
        <FollowUpForm
          followUp={followUp}
          canEdit={can(isNew ? PERMISSIONS.campaigns.create : PERMISSIONS.campaigns.update)}
          saving={save.isPending}
          onSubmit={(v) => save.mutate(v)}
          onCancel={() => navigate(FOLLOW_UPS_TAB)}
        />
      )}
    </div>
  );
}
