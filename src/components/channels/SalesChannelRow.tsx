import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import Link from "@/components/ui/Link";
import { ChannelAvatar } from "@/components/channels/ChannelAvatar";
import { ChannelFieldsPanel } from "@/components/channels/ChannelFieldsPanel";
import { SyncBadge } from "@/components/listings/SyncBadge";
import { useToast } from "@/context";
import { useChannelFieldSources } from "@/hooks/useChannelFieldSources";
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
  defaultOpen?: boolean;
}

function fieldErrorsFrom(err: unknown): Record<string, string> {
  const source = err instanceof ChannelPushError ? err.pushError : (err as { errors?: { field: string; message: string }[] });
  return Object.fromEntries((source?.errors ?? []).map(({ field, message }) => [field, message]));
}

// One Sales Channels row: tick to list, untick to end the listing.
export function SalesChannelRow({ channel, index, product, productDefaults, listingSummary, mappedCategory, defaultOpen = false }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const adapter = CHANNEL_FORM_ADAPTERS[channel.key];
  const listed = !!listingSummary;
  const schema = channel.fieldSchema ?? [];
  const categoryKey = schema.find((d) => d.type === "category")?.key;
  const sources = useChannelFieldSources(channel.key, categoryKey, mappedCategory);

  const [open, setOpen] = useState(defaultOpen);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<ChannelFormState | null>(() => (adapter && !listed ? adapter.initialForm(product) : null));

  // Full listing: the list row's photos aren't populated, so it can't round-trip a save.
  const { data: listingRes } = useQuery({
    queryKey: ["listing", listingSummary?._id],
    queryFn: () => getListing(listingSummary!._id),
    enabled: listed && !!adapter,
  });
  const listing = listingRes?.data ?? null;

  useEffect(() => {
    if (!adapter) return;
    if (listing) setForm(adapter.fromListing(listing));
    else if (!listed) setForm(adapter.initialForm(product));
  }, [adapter, listing, listed, product]);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["listings"] });
    void queryClient.invalidateQueries({ queryKey: ["channels"] });
    if (listingSummary) void queryClient.invalidateQueries({ queryKey: ["listing", listingSummary._id] });
  }

  function onMutationError(err: unknown) {
    setErrors(fieldErrorsFrom(err));
    setOpen(true);
    if (err instanceof ChannelPushError) refresh(); // the listing exists even though the push was rejected
    toast({ title: (err as Error).message, tone: "danger" });
  }

  const createMutation = useMutation({
    mutationFn: (f: ChannelFormState) => adapter!.create(product, f),
    onSuccess: () => {
      setErrors({});
      refresh();
      toast({ title: `Listed on ${channel.name} — sync queued`, tone: "success" });
    },
    onError: onMutationError,
  });

  const saveMutation = useMutation({
    mutationFn: (f: ChannelFormState) => adapter!.saveAndSync(listingSummary!._id, f),
    onSuccess: () => {
      setErrors({});
      refresh();
      toast({ title: `${channel.name} updated — sync queued`, tone: "success" });
    },
    onError: onMutationError,
  });

  // Same delete flow as the Listings page (ends on the platform, then soft-deletes).
  const removeMutation = useMutation({
    mutationFn: () => deleteListing(listingSummary!._id),
    onSuccess: () => {
      setConfirmRemove(false);
      setOpen(false);
      refresh();
      toast({ title: `Removed from ${channel.name}`, tone: "success" });
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
    if (Object.keys(errs).length) setOpen(true);
    return Object.keys(errs).length === 0;
  }

  function handleToggle(checked: boolean) {
    if (!checked) {
      if (listed) setConfirmRemove(true);
      return;
    }
    if (form && validate(form)) createMutation.mutate(form);
  }

  function patchForm(patch: Partial<ChannelFormState>) {
    setForm((prev) => (prev ? ({ ...prev, ...patch } as ChannelFormState) : prev));
  }

  const connected = channel.connection.status === "connected";
  // NOTE: not-connected only blocks NEW listings; existing ones stay manageable.
  const blockedReason = !channel.available
    ? channel.unavailable_reason
    : !adapter
      ? `${channel.name} can't be managed from the product form yet.`
      : !connected && !listed
        ? "not connected"
        : null;
  const busy = createMutation.isPending || saveMutation.isPending || removeMutation.isPending;

  const listingCategory = categoryKey ? ((listingSummary as unknown as Record<string, unknown> | null)?.[categoryKey] as string | null) : null;
  const categoryText = listingCategory
    ? `${listingCategory} (set on this product)`
    : mappedCategory
      ? `${mappedCategory.name ?? mappedCategory.id} (from default)`
      : categoryKey
        ? "not set"
        : null;

  return (
    <div className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Checkbox
          checked={listed || createMutation.isPending}
          disabled={!!blockedReason || busy || !form}
          onChange={(e) => handleToggle(e.target.checked)}
          aria-label={`List on ${channel.name}`}
        />
        <ChannelAvatar name={channel.name} index={index} channelKey={channel.key} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">{channel.name}</p>
          {blockedReason === "not connected" ? (
            <p className="text-xs text-fg/55">
              Not connected —{" "}
              <Link href={`/settings/integrations/${channel.key}`} className="font-medium text-accent hover:underline">
                Connect
              </Link>
            </p>
          ) : blockedReason ? (
            <p className="text-xs text-fg/55">{blockedReason}</p>
          ) : categoryText ? (
            <p className={cn("truncate text-xs", categoryText === "not set" ? "text-warn" : "text-fg/55")}>Category: {categoryText}</p>
          ) : null}
        </div>

        {listed && listingSummary && (
          <div className="flex items-center gap-2">
            <SyncBadge status={listingSummary.sync_status} />
            <span className="whitespace-nowrap text-xs text-fg/50">
              {listingSummary.synced_at ? `synced ${formatRelativeTime(listingSummary.synced_at)}` : "not synced yet"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2 text-xs"
              disabled={busy || !form}
              onClick={() => form && validate(form) && saveMutation.mutate(form)}
              title="Save this panel and queue a sync"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", saveMutation.isPending && "animate-spin")} />
              Re-sync
            </Button>
          </div>
        )}

        {adapter && !blockedReason && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? `Hide ${channel.name} details` : `Show ${channel.name} details`}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </Button>
        )}
      </div>

      {listed && listingSummary?.sync_error && <p className="mt-2 pl-8 text-xs text-danger">Sync error: {listingSummary.sync_error}</p>}

      {open && form && adapter && (
        <div className="mt-4 space-y-4 rounded-xs border border-border bg-bg-2/40 p-4">
          <ChannelFieldsPanel
            channel={channel}
            form={form}
            onChange={patchForm}
            errors={errors}
            sources={sources}
            mappedCategory={mappedCategory}
            productDefaults={productDefaults}
            supportsPhotos={adapter.supportsPhotoOverrides}
          />
          <div className="flex justify-end gap-2">
            {listed ? (
              <Button type="button" size="sm" disabled={busy} onClick={() => validate(form) && saveMutation.mutate(form)}>
                {saveMutation.isPending ? "Saving…" : `Save & sync ${channel.name}`}
              </Button>
            ) : (
              <Button type="button" size="sm" disabled={busy} onClick={() => handleToggle(true)}>
                {createMutation.isPending ? "Listing…" : `List on ${channel.name}`}
              </Button>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove from ${channel.name}?`}
        description={`This ends the live ${channel.name} listing for this product. The product itself is unaffected.`}
        confirmLabel="Remove listing"
        tone="danger"
        confirming={removeMutation.isPending}
        onConfirm={() => removeMutation.mutate()}
      />
    </div>
  );
}
