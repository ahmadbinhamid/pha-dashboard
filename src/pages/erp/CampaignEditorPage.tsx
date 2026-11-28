import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BreadcrumbNav } from "@/components/ui/BreadcrumbNav";
import { SkeletonText } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { CampaignForm } from "@/components/campaigns/CampaignForm";
import { CampaignRunsTable } from "@/components/campaigns/CampaignRunsTable";
import { CampaignSendCard } from "@/components/campaigns/CampaignSendCard";
import { CampaignStatusBadge } from "@/components/campaigns/CampaignStatusBadge";
import { CAMPAIGNS_BASE_PATH, LIVE_RUN_REFETCH_MS } from "@/config/campaigns";
import { PERMISSIONS } from "@/config/permissions";
import { useToast } from "@/context";
import { useMyAccess } from "@/hooks/useMyAccess";
import { CAMPAIGNS_QUERY_KEY, campaignQueryKey, createCampaign, getCampaign, updateCampaign } from "@/lib/api/campaigns";
import { formValuesToPayload, isRunLive } from "@/lib/campaigns/campaignForm";
import type { CampaignFormValues } from "@/lib/validation/campaign";

// Serves /campaigns/new and /campaigns/:id.
export default function CampaignEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can } = useMyAccess();
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: campaignQueryKey(id ?? ""),
    queryFn: () => getCampaign(id!),
    enabled: !isNew,
    refetchInterval: (query) => (isRunLive(query.state.data?.data?.runs[0]) ? LIVE_RUN_REFETCH_MS : false),
  });
  const campaign = data?.data ?? null;
  const locked = campaign?.status === "sent" || campaign?.status === "sending";
  const canEdit = can(isNew ? PERMISSIONS.campaigns.create : PERMISSIONS.campaigns.update) && !locked;

  const mutation = useMutation({
    mutationFn: (values: CampaignFormValues) =>
      isNew ? createCampaign(formValuesToPayload(values)) : updateCampaign(id!, formValuesToPayload(values)),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: CAMPAIGNS_QUERY_KEY });
      toast({ title: isNew ? "Campaign created" : "Campaign saved", tone: "success" });
      if (isNew) navigate(`${CAMPAIGNS_BASE_PATH}/${res.data._id}`, { replace: true });
    },
    onError: (err: Error) => toast({ title: "Couldn't save the campaign", description: err.message, tone: "danger" }),
  });

  const title = isNew ? "New campaign" : (campaign?.name ?? "Campaign");

  return (
    <div className="space-y-6">
      <BreadcrumbNav items={[{ label: "Campaigns", href: CAMPAIGNS_BASE_PATH }, { label: title }]} />
      <PageHeader
        title={title}
        description={isNew ? "Write it once, then send now, schedule it, or repeat it as a newsletter." : undefined}
      >
        {campaign ? <CampaignStatusBadge status={campaign.status} /> : null}
      </PageHeader>

      {!isNew && isLoading ? (
        <SkeletonText lines={10} />
      ) : (
        <CampaignForm
          campaign={campaign}
          canEdit={canEdit}
          saving={mutation.isPending}
          onSubmit={(values) => mutation.mutate(values)}
          onCancel={() => navigate(CAMPAIGNS_BASE_PATH)}
          onDirtyChange={setDirty}
          aside={campaign ? <CampaignSendCard campaign={campaign} dirty={dirty} /> : null}
          footer={campaign ? <CampaignRunsTable runs={campaign.runs} /> : null}
        />
      )}
    </div>
  );
}
