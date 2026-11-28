import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus, Search } from "lucide-react";
import { Can } from "@/components/auth/Can";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { SkeletonText } from "@/components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { CampaignRowActionsMenu } from "@/components/campaigns/CampaignRowActionsMenu";
import { CampaignStatusBadge } from "@/components/campaigns/CampaignStatusBadge";
import { CAMPAIGNS_BASE_PATH, CAMPAIGN_STATUS_FILTER_OPTIONS, LIVE_RUN_REFETCH_MS } from "@/config/campaigns";
import { DEFAULT_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from "@/config/pagination";
import { PERMISSIONS } from "@/config/permissions";
import { useToast } from "@/context";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { CAMPAIGNS_QUERY_KEY, deleteCampaign, duplicateCampaign, getCampaigns, pauseCampaign } from "@/lib/api/campaigns";
import { describeRecurrence, describeRun, formatDateTime, isRunLive } from "@/lib/campaigns/campaignForm";
import type { CampaignListItem, CampaignStatus } from "@/types/campaign";

const ALL = "all";

/** What's next for the campaign, or what last happened. */
function scheduleLabel(c: CampaignListItem) {
  if (c.kind === "recurring") return c.status === "active" ? `Next ${formatDateTime(c.next_run_at, c.recurrence.timezone)}` : describeRecurrence(c);
  if (c.status === "scheduled") return `Sends ${formatDateTime(c.next_run_at)}`;
  if (c.last_run_at) return `Sent ${formatDateTime(c.last_run_at)}`;
  return "Not sent";
}

export function CampaignsPanel() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const [status, setStatus] = useState(ALL);
  const [deleteTarget, setDeleteTarget] = useState<CampaignListItem | null>(null);


  const params = { page, limit, search: search || undefined, status: status === ALL ? undefined : (status as CampaignStatus) };
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...CAMPAIGNS_QUERY_KEY, "list", params],
    queryFn: () => getCampaigns(params),
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      query.state.data?.data?.items.some((c) => isRunLive(c.last_run)) ? LIVE_RUN_REFETCH_MS : false,
  });
  const campaigns = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: CAMPAIGNS_QUERY_KEY });
  const onError = (title: string) => (err: Error) => toast({ title, description: err.message, tone: "danger" });

  const duplicateMutation = useMutation({
    mutationFn: duplicateCampaign,
    onSuccess: (res) => {
      void invalidate();
      navigate(`${CAMPAIGNS_BASE_PATH}/${res.data._id}`);
    },
    onError: onError("Couldn't duplicate the campaign"),
  });
  const pauseMutation = useMutation({
    mutationFn: pauseCampaign,
    onSuccess: () => {
      void invalidate();
      toast({ title: "Campaign paused", tone: "success" });
    },
    onError: onError("Couldn't pause the campaign"),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => {
      void invalidate();
      toast({ title: "Campaign deleted", tone: "success" });
      setDeleteTarget(null);
    },
    onError: onError("Couldn't delete the campaign"),
  });

  const open = (c: CampaignListItem) => navigate(`${CAMPAIGNS_BASE_PATH}/${c._id}`);

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
            <Input placeholder="Search campaigns…" value={searchInput} onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }} className="pl-9" />
          </div>
          <SingleSelect
            options={CAMPAIGN_STATUS_FILTER_OPTIONS}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            className="sm:w-44 sm:shrink-0"
          />
        </div>
        <Can permission={PERMISSIONS.campaigns.create}>
          <Button variant="primary" onClick={() => navigate(`${CAMPAIGNS_BASE_PATH}/new`)}>
            <Plus className="h-4 w-4" />
            New campaign
          </Button>
        </Can>
      </div>

      {isLoading ? (
        <div className="p-5">
          <SkeletonText lines={6} />
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={search || status !== ALL ? "No campaigns match" : "No campaigns yet"}
          description="Send a one-off promotion, or set up a weekly or monthly newsletter to your subscribers."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-200">
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Last send</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c._id} className="cursor-pointer" onClick={() => open(c)}>
                  <TableCell>
                    <div className="truncate font-medium text-fg">{c.name}</div>
                    <div className="truncate text-xs text-fg/50">
                      {c.kind === "recurring" ? "Newsletter" : "One-off"} · {c.subject || "No subject yet"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <CampaignStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-fg/60">{scheduleLabel(c)}</TableCell>
                  <TableCell className="text-fg/60">{c.last_run ? describeRun(c.last_run) : "—"}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <CampaignRowActionsMenu
                      status={c.status}
                      onOpen={() => open(c)}
                      onDuplicate={() => duplicateMutation.mutate(c._id)}
                      onPause={() => pauseMutation.mutate(c._id)}
                      onDelete={() => setDeleteTarget(c)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination
        currentPage={page}
        totalPages={data?.data?.totalPages ?? 1}
        totalItems={total}
        itemsPerPage={limit}
        onLimitChange={(l) => {
          setLimit(l);
          setPage(1);
        }}
        isLoading={isFetching}
        onPageChange={setPage}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete this campaign?"
        description={`"${deleteTarget?.name}" and its schedule will be removed. Emails already sent can't be recalled.`}
        confirmLabel="Delete"
        tone="danger"
        confirming={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
      />
    </Card>
  );
}
