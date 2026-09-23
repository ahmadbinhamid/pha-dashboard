import { useNavigate } from "react-router-dom";
import { ChevronRight, Store } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardSectionLabel } from "@/components/dashboard/DashboardSectionLabel";
import { getChannelLogo } from "@/components/channels/channelLogos";
import { cn } from "@/utils/cn";
import { formatRelativeTime } from "@/utils/formatRelativeTime";
import { CATEGORICAL_COLOR_VARS as AVATAR_COLOR_VARS } from "@/config/categoricalColors";
import type { ChannelHealth } from "@/types/dashboard";

const STATUS_LABEL: Record<ChannelHealth["status"], string> = {
  operational: "Active",
  attention: "Attention",
  not_connected: "Not connected",
};

const STATUS_DOT: Record<ChannelHealth["status"], string> = {
  operational: "bg-ok",
  attention: "bg-danger",
  not_connected: "bg-fg/30",
};

const STATUS_TEXT: Record<ChannelHealth["status"], string> = {
  operational: "text-ok",
  attention: "text-danger",
  not_connected: "text-fg/45",
};

const STATUS_BORDER: Record<ChannelHealth["status"], string> = {
  operational: "border-border",
  attention: "border-danger/50",
  not_connected: "border-border",
};

// Initials chip is purely decorative identity (not status), cycled by index — stable across renders since `channels` order doesn't change.
function initials(name: string) {
  const words = name.trim().split(/\s+/);
  return words.length === 1 ? words[0].slice(0, 2).toUpperCase() : (words[0][0] + words[1][0]).toUpperCase();
}

function channelDetail(channel: ChannelHealth) {
  if (channel.detail) return channel.detail;
  if (channel.status === "not_connected") return "No listings yet";
  const relative = formatRelativeTime(channel.lastSyncedAt);
  return relative ? `Synced ${relative}` : "Not yet synced";
}

// eBay/Google get their real logo; "storefront" gets the tenant's own
// uploaded logo (Branding settings) if they've set one; anything else falls
// back to the categorical-color initials chip below. Kept as this card's
// own chip (rounded-xl, not ChannelAvatar's rounded-full) per this file's
// own header comment — both just call into the same getChannelLogo() so
// eBay/Google are never drawn twice.
function ChannelIdentityChip({ channel, index, tenantLogoUrl }: { channel: ChannelHealth; index: number; tenantLogoUrl?: string | null }) {
  const BrandLogo = getChannelLogo(channel.key);
  const isStorefront = channel.key === "storefront";

  if (BrandLogo || isStorefront) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-bg-2 ring-1 ring-inset ring-border transition-transform duration-200 group-hover:scale-105">
        {BrandLogo ? (
          <BrandLogo className="h-5 w-5" />
        ) : tenantLogoUrl ? (
          <img src={tenantLogoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Store className="h-4.5 w-4.5 text-fg/50" />
        )}
      </span>
    );
  }

  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-transform duration-200 group-hover:scale-105"
      style={{
        color: AVATAR_COLOR_VARS[index % AVATAR_COLOR_VARS.length],
        backgroundColor: `color-mix(in srgb, ${AVATAR_COLOR_VARS[index % AVATAR_COLOR_VARS.length]} 14%, transparent)`,
      }}
    >
      {initials(channel.name)}
    </span>
  );
}

export function ActiveChannelsCard({
  channels,
  loading,
  tenantLogoUrl,
}: {
  channels: ChannelHealth[];
  loading?: boolean;
  /** Tenant's own uploaded logo (Branding settings) — shown for the "storef... */
  tenantLogoUrl?: string | null;
}) {
  const navigate = useNavigate();
  const connectedCount = channels.filter((c) => c.status !== "not_connected").length;

  return (
    <Card className="flex h-full flex-col p-4 shadow-card transition-shadow duration-300 hover:shadow-md sm:p-5">
      <div className="flex items-center justify-between">
        <DashboardSectionLabel>Sales Channels</DashboardSectionLabel>
        {!loading && channels.length > 0 && (
          <Badge variant="ok">
            {connectedCount} Connected
          </Badge>
        )}
      </div>

      <CardContent className="flex-1 space-y-2 px-0 pt-4">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
        ) : (
          channels.map((channel, i) => (
            <div
              key={channel.key}
              onClick={() => navigate("/listings")}
              className={cn(
                "group flex cursor-pointer items-center justify-between gap-2 rounded-xl border bg-muted/40 px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted/70",
                STATUS_BORDER[channel.status],
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <ChannelIdentityChip channel={channel} index={i} tenantLogoUrl={tenantLogoUrl} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-fg">{channel.name}</div>
                  <div className="truncate text-xs text-fg/50">{channelDetail(channel)}</div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className={cn("flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold", STATUS_TEXT[channel.status])}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[channel.status])} aria-hidden="true" />
                  {STATUS_LABEL[channel.status]}
                </span>
                <ChevronRight className="h-4 w-4 text-fg/30 transition group-hover:translate-x-0.5 group-hover:text-fg/60" />
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Button variant="primary" size="sm" className="mt-2 w-full gap-1.5" onClick={() => navigate("/listings")}>
        Manage All Integrations
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </Card>
  );
}
