import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import Link from "@/components/ui/Link";
import { ChannelAvatar } from "@/components/channels/ChannelAvatar";
import { ChannelAttentionNotice } from "@/components/channels/ChannelAttentionNotice";
import { SalesChannelResyncButton } from "@/components/channels/SalesChannelResyncButton";
import { SalesChannelRowActionsMenu } from "@/components/channels/SalesChannelRowActionsMenu";
import { CHANNEL_STATUS_REASON_ACTION } from "@/config/channelStatusReasons";
import { CATEGORY_SOURCE_LABEL } from "@/config/salesChannels";
import { ChannelSettingsDrawer } from "@/components/channels/ChannelSettingsDrawer";
import { SyncBadge } from "@/components/listings/SyncBadge";
import { useToast } from "@/context";
import { useChannelFieldSources } from "@/hooks/useChannelFieldSources";
import { isAwaitingSync } from "@/hooks/useProductChannelListings";
import { deleteListing, getListing } from "@/lib/api/listings";
import { CHANNEL_FORM_ADAPTERS, ChannelPushError, type ChannelFormState } from "@/lib/marketplace/channelForms";
import { validateChannelFields } from "@/lib/validation/channelFields";
import { formatRelativeTime } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { ChannelSummary } from "@/types/channel";
import type { MappedCategory } from "@/types/categoryMapping";
import type { AnyMarketplaceListing, ListingProductDefaults } from "@/types/marketplace";
import type { Product } from "@/types/product";

interface Props {
  channel: ChannelSummary;
  index: number;
  product: Product;
  productDefaults: ListingProductDefaults;
  // The product's base (non-variant) listing on this channel.
  listingSummary: AnyMarketplaceListing | null;
  mappedCategory: MappedCategory | null | undefined;
  // Last product save; row shows "Syncing" until the channel catches up.
  syncingSince: number | null;
  defaultOpen?: boolean;
}

function fieldErrorsFrom(err: unknown): Record<string, string> {
  const source = err instanceof ChannelPushError ? err.pushError : (err as { errors?: { field: string; message: string }[] });
  return Object.fromEntries((source?.errors ?? []).map(({ field, message }) => [field, message]));
}

// Where to fix a channel that can't be used yet.
function fixLink(channel: ChannelSummary) {
  const reason = channel.connection.status_reason;
  if (reason) return CHANNEL_STATUS_REASON_ACTION[reason].href;
  return channel.available ? `/settings/integrations/${channel.key}` : "/settings/integrations/domains";
}

// Sales channels row: tick to list, untick to end, "Edit listing" for settings.
export function SalesChannelRow({
  channel,
  index,
  product,
  productDefaults,
  listingSummary,
  mappedCategory,
  syncingSince,
  defaultOpen = false,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const adapter = CHANNEL_FORM_ADAPTERS[channel.key];
  const listed = !!listingSummary;
  const schema = channel.fieldSchema ?? [];
  const categoryKey = schema.find((d) => d.type === "category")?.key;
  const sources = useChannelFieldSources(channel.key, categoryKey, mappedCategory, product);

  const [drawerOpen, setDrawerOpen] = useState(defaultOpen);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<ChannelFormState | null>(() => (adapter && !listed ? adapter.initialForm(product) : null));

  // Full listing: list-row photos aren't populated, so can't round-trip a save.
  const { data: listingRes } = useQuery({
    queryKey: ["listing", listingSummary?._id],
    queryFn: () => getListing(listingSummary!._id),
    enabled: listed && !!adapter,
  });
  const listing = listingRes?.data ?? null;

  function freshForm() {
    if (!adapter) return null;
    return listing ? adapter.fromListing(listing) : listed ? null : adapter.initialForm(product);
  }

  useEffect(() => {
    setForm(freshForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, listing, listed, product]);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["listings"] });
    void queryClient.invalidateQueries({ queryKey: ["channels"] });
    if (listingSummary) void queryClient.invalidateQueries({ queryKey: ["listing", listingSummary._id] });
  }

  function onMutationError(err: unknown) {
    setErrors(fieldErrorsFrom(err));
    setDrawerOpen(true);
    if (err instanceof ChannelPushError) refresh(); // the listing exists even though the push was rejected
    toast({ title: (err as Error).message, tone: "danger" });
  }

  const createMutation = useMutation({
    mutationFn: (f: ChannelFormState) => adapter!.create(product, f),
    onSuccess: () => {
      setErrors({});
      setDrawerOpen(false);
      refresh();
      toast({ title: `Listed on ${channel.name} · syncing`, tone: "success" });
    },
    onError: onMutationError,
  });

  const saveMutation = useMutation({
    mutationFn: (f: ChannelFormState) => adapter!.saveAndSync(listingSummary!._id, f),
    onSuccess: () => {
      setErrors({});
      setDrawerOpen(false);
      refresh();
      toast({ title: `${channel.name} settings saved · syncing`, tone: "success" });
    },
    onError: onMutationError,
  });

  // Same delete flow as Listings page (ends on platform, then soft-deletes).
  const endMutation = useMutation({
    mutationFn: () => deleteListing(listingSummary!._id),
    onSuccess: () => {
      setConfirmEnd(false);
      refresh();
      toast({ title: `${channel.name} listing ended`, tone: "success" });
    },
    onError: (err: Error) => toast({ title: err.message, tone: "danger" }),
  });

  function validate(f: ChannelFormState) {
    const errs = validateChannelFields(schema, f as unknown as Record<string, unknown>, {
      fallbacks: sources.fallbacks,
      constraints: channel.productConstraints,
      productDefaults,
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function submit() {
    if (!form) return;
    if (!validate(form)) return setDrawerOpen(true);
    if (listed) saveMutation.mutate(form);
    else createMutation.mutate(form);
  }

  function handleToggle(checked: boolean) {
    if (!checked) return listed && setConfirmEnd(true);
    submit();
  }

  function cancelDrawer() {
    setDrawerOpen(false);
    setErrors({});
    setForm(freshForm());
  }

  const connected = channel.connection.status === "connected";
  // NOTE: not-connected only blocks NEW listings; existing ones stay manageable.
  const blocked = !channel.available || !adapter || (!connected && !listed);
  const blockedReason = channel.connection.status_reason
    ? "Needs attention"
    : !channel.available
      ? "Needs a verified storefront domain"
      : !adapter
        ? `${channel.name} can't be managed from the product form yet`
        : "Not connected";
  const busy = createMutation.isPending || saveMutation.isPending || endMutation.isPending;
  const awaiting = !!listingSummary && isAwaitingSync(listingSummary, syncingSince);

  const listingCategory = categoryKey ? ((listingSummary as unknown as Record<string, unknown> | null)?.[categoryKey] as string | null) : null;
  const categoryId = listingCategory || mappedCategory?.id || null;
  const categoryOverridden = !!listingCategory;

  // Clears the listing's own category and re-syncs, so the mapping applies.
  function resetCategory() {
    if (!form || !categoryKey) return;
    const next = { ...form, [categoryKey]: "" } as ChannelFormState;
    if (validate(next)) saveMutation.mutate(next);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <Checkbox
          checked={listed || createMutation.isPending}
          disabled={blocked || busy || !form}
          onChange={(e) => handleToggle(e.target.checked)}
          aria-label={`List on ${channel.name}`}
        />
        <ChannelAvatar name={channel.name} index={index} channelKey={channel.key} size="md" />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-semibold", blocked ? "text-fg/60" : "text-fg")}>{channel.name}</p>
          {blocked ? (
            <p className="text-xs text-fg/50">{blockedReason}</p>
          ) : categoryKey ? (
            <p className="flex flex-wrap items-center gap-2 text-xs text-fg/50">
              {categoryId ? (
                <>
                  <span>
                    Category <span className="font-mono text-fg/70">{categoryId}</span>
                  </span>
                  {(categoryOverridden || mappedCategory) && (
                    <Badge variant={categoryOverridden ? "warn" : "muted"} className="px-1.5 py-0.5 text-2xs font-medium">
                      {categoryOverridden ? CATEGORY_SOURCE_LABEL.override(channel.name) : CATEGORY_SOURCE_LABEL.mapping}
                    </Badge>
                  )}
                  {categoryOverridden && mappedCategory && (
                    <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-2xs" disabled={busy || !form} onClick={resetCategory}>
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </Button>
                  )}
                </>
              ) : (
                <span className="text-warn">Category not set</span>
              )}
            </p>
          ) : null}
        </div>

        {blocked ? (
          <Link href={fixLink(channel)} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
            {!channel.available ? "Verify domain in Settings › Domains" : "Connect"}
            <ExternalLink className="h-3 w-3" />
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            {listed && listingSummary && (
              <div className="flex items-center gap-1.5">
                <SyncBadge status={awaiting ? "pending" : listingSummary.sync_status} />
                <SalesChannelResyncButton
                  onResync={() => form && validate(form) && saveMutation.mutate(form)}
                  disabled={busy || !form}
                  resyncing={saveMutation.isPending || awaiting}
                  syncLabel={
                    awaiting
                      ? "Syncing…"
                      : listingSummary.synced_at
                        ? `Synced ${formatRelativeTime(listingSummary.synced_at)}`
                        : "Not synced yet"
                  }
                />
              </div>
            )}
            <SalesChannelRowActionsMenu
              channelName={channel.name}
              onEdit={() => setDrawerOpen(true)}
              editDisabled={!form}
              externalUrl={listingSummary?.external_url}
            />
          </div>
        )}
      </div>

      <ChannelAttentionNotice channel={channel} className="mx-5 mb-3" />

      {listed && listingSummary?.sync_status === "error" && listingSummary.sync_error && !awaiting && !channel.connection.status_reason && (
        <p className="mx-5 mb-3 flex items-start gap-2 rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {listingSummary.sync_error}
        </p>
      )}

      {confirmEnd && (
        <div className="mx-5 mb-4 flex flex-wrap items-center gap-2 rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">
            End the {channel.name} listing? Buyers will no longer see it.
          </span>
          <Button type="button" variant="secondary" size="sm" className="h-7" onClick={() => setConfirmEnd(false)} disabled={endMutation.isPending}>
            Keep listed
          </Button>
          <Button type="button" variant="danger" size="sm" className="h-7" onClick={() => endMutation.mutate()} disabled={endMutation.isPending}>
            {endMutation.isPending ? "Ending…" : "End listing"}
          </Button>
        </div>
      )}

      {form && adapter && (
        <ChannelSettingsDrawer
          open={drawerOpen}
          onCancel={cancelDrawer}
          onSubmit={submit}
          submitting={createMutation.isPending || saveMutation.isPending}
          channel={channel}
          index={index}
          status={listed && listingSummary ? (awaiting ? "pending" : listingSummary.sync_status) : null}
          product={product}
          form={form}
          onChange={(patch) => setForm((prev) => (prev ? ({ ...prev, ...patch } as ChannelFormState) : prev))}
          errors={errors}
          sources={sources}
          mappedCategory={mappedCategory}
          productDefaults={productDefaults}
          supportsPhotos={adapter.supportsPhotoOverrides}
        />
      )}
    </div>
  );
}
