import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, FlaskConical, Pause, Play, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InlineNotice } from "@/components/ui/InlineNotice";
import { CampaignScheduleModal } from "@/components/campaigns/CampaignScheduleModal";
import { CampaignStatusBadge } from "@/components/campaigns/CampaignStatusBadge";
import { CampaignTestSendModal } from "@/components/campaigns/CampaignTestSendModal";
import { PERMISSIONS } from "@/config/permissions";
import { useToast } from "@/context";
import { useMyAccess } from "@/hooks/useMyAccess";
import { CAMPAIGNS_QUERY_KEY, pauseCampaign, scheduleCampaign, sendCampaign } from "@/lib/api/campaigns";
import { describeRecurrence, describeRun, formatDateTime } from "@/lib/campaigns/campaignForm";
import { pluralize } from "@/utils/format";
import type { CampaignDetail } from "@/types/campaign";

interface CampaignSendCardProps {
  campaign: CampaignDetail;
  // Unsaved edits: sending would go out with the old content.
  dirty: boolean;
}

function statusLine(c: CampaignDetail) {
  if (c.kind === "recurring") {
    return c.status === "active" ? `Next send ${formatDateTime(c.next_run_at, c.recurrence.timezone)}` : describeRecurrence(c);
  }
  if (c.status === "scheduled") return `Sends ${formatDateTime(c.next_run_at)}`;
  if (c.status === "sending") return "Sending now…";
  if (c.status === "sent") return `Sent ${formatDateTime(c.last_run_at)}`;
  return "Not sent yet";
}

export function CampaignSendCard({ campaign, dirty }: CampaignSendCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can } = useMyAccess();
  const canSend = can(PERMISSIONS.campaigns.send);
  const canTest = canSend || can(PERMISSIONS.campaigns.update);
  const [confirmSend, setConfirmSend] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);

  const recurring = campaign.kind === "recurring";
  const { status } = campaign;
  const latest = campaign.runs[0];

  const onDone = (title: string) => () => {
    void queryClient.invalidateQueries({ queryKey: CAMPAIGNS_QUERY_KEY });
    toast({ title, tone: "success" });
  };
  const onError = (title: string) => (err: Error) => toast({ title, description: err.message, tone: "danger" });

  const sendMutation = useMutation({
    mutationFn: () => sendCampaign(campaign._id),
    onSuccess: () => {
      setConfirmSend(false);
      onDone("Campaign is sending")();
    },
    onError: onError("Couldn't send the campaign"),
  });
  const scheduleMutation = useMutation({
    mutationFn: (at?: string) => scheduleCampaign(campaign._id, at),
    onSuccess: () => {
      setScheduleOpen(false);
      onDone(recurring ? "Newsletter switched on" : "Campaign scheduled")();
    },
    onError: onError("Couldn't schedule the campaign"),
  });
  const pauseMutation = useMutation({
    mutationFn: () => pauseCampaign(campaign._id),
    onSuccess: onDone("Campaign paused"),
    onError: onError("Couldn't pause the campaign"),
  });

  const canStartOneTime = !recurring && (status === "draft" || status === "scheduled");
  const canActivate = recurring && (status === "draft" || status === "paused");
  const pausable = status === "scheduled" || status === "active";

  return (
    <Card>
      <CardHeader title="Sending" right={<CampaignStatusBadge status={status} />} description={statusLine(campaign)} />
      <CardContent className="space-y-3">
        <p className="text-sm text-fg/70">
          Goes to <span className="font-medium text-fg">{pluralize(campaign.audience_count, "subscribed contact")}</span>
          {campaign.audience.type === "lists" ? ` on ${campaign.audience.lists.join(", ")}` : ""}.
        </p>
        {latest ? <p className="text-xs text-fg/55">Last send: {describeRun(latest)}</p> : null}
        {dirty ? <InlineNotice variant="warn">Save your changes before sending.</InlineNotice> : null}

        {canSend ? (
          <div className="flex flex-col gap-2">
            {canStartOneTime ? (
              <>
                <Button variant="primary" disabled={dirty || !campaign.audience_count} onClick={() => setConfirmSend(true)}>
                  <Send className="h-4 w-4" />
                  Send now
                </Button>
                <Button variant="secondary" disabled={dirty} onClick={() => setScheduleOpen(true)}>
                  <CalendarClock className="h-4 w-4" />
                  {status === "scheduled" ? "Change time" : "Schedule"}
                </Button>
              </>
            ) : null}
            {canActivate ? (
              <Button variant="primary" disabled={dirty || scheduleMutation.isPending} onClick={() => scheduleMutation.mutate(undefined)}>
                <Play className="h-4 w-4" />
                {status === "paused" ? "Resume newsletter" : "Start newsletter"}
              </Button>
            ) : null}
            {pausable ? (
              <Button variant="secondary" disabled={pauseMutation.isPending} onClick={() => pauseMutation.mutate()}>
                <Pause className="h-4 w-4" />
                {recurring ? "Pause newsletter" : "Unschedule"}
              </Button>
            ) : null}
          </div>
        ) : null}
        {canTest && status !== "sent" ? (
          <Button variant="ghost" className="w-full" disabled={dirty} onClick={() => setTestOpen(true)}>
            <FlaskConical className="h-4 w-4" />
            Send a test
          </Button>
        ) : null}
      </CardContent>

      <ConfirmModal
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title="Send this campaign now?"
        description={`It goes to ${pluralize(campaign.audience_count, "subscribed contact")} straight away and can't be recalled.`}
        confirmLabel="Send now"
        tone="accent"
        confirming={sendMutation.isPending}
        onConfirm={() => sendMutation.mutate()}
      />
      <CampaignScheduleModal
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        initialValue={campaign.scheduled_at}
        scheduling={scheduleMutation.isPending}
        onSchedule={(iso) => scheduleMutation.mutate(iso)}
      />
      <CampaignTestSendModal campaignId={campaign._id} open={testOpen} onOpenChange={setTestOpen} />
    </Card>
  );
}
