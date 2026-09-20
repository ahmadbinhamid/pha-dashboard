import { AlertTriangle, ArrowRight, Loader2, Plug } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ChannelAvatar } from "@/components/channels/ChannelAvatar";
import { cn } from "@/utils/cn";
import { formatRelativeTime } from "@/utils/formatRelativeTime";
import type { ChannelSummary } from "@/types/channel";

// `health_status` is a two-state ("healthy" | "needs_attention") verdict
// server-side (channel.service.js) that folds LISTING trouble in but not
// "never connected" — a channel nobody has authorized yet has 0 listings, 0
// errors, so it computes as "healthy" exactly like a connected channel that
// simply has nothing listed today. Those are very different situations for
// an operator to see, so this card checks `connection.status` FIRST and only
// falls back to the listing-level healthy/needs_attention read once a
// channel is actually connected. "degraded" is deliberately left to that
// fallback — health_status already treats it as needs_attention, and this
// card would otherwise have to duplicate that rule.
const CARD_STATE: Record<
  "not_connected" | "pending" | "connection_error" | "healthy" | "needs_attention",
  { dot: string; label: (c: ChannelSummary) => string; tone: string }
> = {
  not_connected: { dot: "bg-fg/30", label: () => "Not connected", tone: "text-fg/50" },
  pending: { dot: "bg-warn", label: () => "Setup incomplete", tone: "text-warn" },
  connection_error: { dot: "bg-danger", label: (c) => c.connection.last_error || "Connection error", tone: "text-danger" },
  healthy: { dot: "bg-ok", label: () => "All healthy", tone: "text-ok" },
  needs_attention: { dot: "bg-danger", label: (c) => `${c.needs_attention_count} need${c.needs_attention_count === 1 ? "s" : ""} attention`, tone: "text-danger" },
};

function cardStateKey(channel: ChannelSummary): keyof typeof CARD_STATE {
  if (channel.connection.status === "disconnected") return "not_connected";
  if (channel.connection.status === "pending") return "pending";
  if (channel.connection.status === "error") return "connection_error";
  return channel.health_status;
}

export function ChannelSummaryCard({
  channel,
  index = 0,
  onClick,
}: {
  channel: ChannelSummary;
  /** Position among the cards shown together — only affects the identity chip's color. */
  index?: number;
  onClick?: () => void;
}) {
  const stateKey = cardStateKey(channel);
  const state = CARD_STATE[stateKey];
  const isSetupState = stateKey === "not_connected" || stateKey === "pending" || stateKey === "connection_error";

  // "synced" is ListingSyncStatus's literal value for "Live" (see
  // src/config/listingStatus.ts's LISTING_SYNC_STATUS_CONFIG) — used as a
  // plain string here since there's no runtime enum object for it on the
  // frontend, matching how ListingsPage.tsx's own SYNC_STATUS_FILTERS does.
  const liveCount = channel.listing_counts["synced"] ?? 0;
  const relativeSync = formatRelativeTime(channel.last_synced_at);

  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "group p-3",
        onClick && "cursor-pointer transition hover:ring-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ChannelAvatar name={channel.name} index={index} />
          <span className="truncate text-xs font-semibold text-fg">{channel.name}</span>
        </div>
        {!isSetupState && relativeSync ? <span className="shrink-0 text-[11px] text-fg/45">{relativeSync}</span> : null}
      </div>

      {isSetupState ? (
        // No listing counts to show for a channel that isn't actually
        // connected yet — showing "0 live" here read as "connected but
        // empty", which is a different (and reassuring, when it shouldn't
        // be) claim than "you haven't set this up".
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", state.tone)}>
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", state.dot)} aria-hidden="true" />
            {stateKey === "pending" ? (
              <Loader2 className="h-3 w-3 shrink-0" aria-hidden="true" />
            ) : stateKey === "connection_error" ? (
              <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
            ) : null}
            <span className="truncate">{state.label(channel)}</span>
          </span>
          {onClick ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
              <Plug className="h-3 w-3" />
              Connect
              <ArrowRight className="h-3 w-3" />
            </span>
          ) : null}
        </div>
      ) : (
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <span className="flex items-baseline gap-1">
            <span className="text-lg font-semibold tracking-tight text-fg tabular-nums">{liveCount}</span>
            <span className="text-[11px] text-fg/55">live</span>
          </span>
          <span className={cn("truncate text-[11px] font-medium", state.tone)}>{state.label(channel)}</span>
        </div>
      )}
    </Card>
  );
}
