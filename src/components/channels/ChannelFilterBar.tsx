import { Card } from "@/components/ui/Card";
import { ViewToggle, type ViewMode } from "@/components/ui/ViewToggle";
import { cn } from "@/utils/cn";
import type { ChannelSummary } from "@/types/channel";

// Quick "which channel is this product listed on" filter for the Products
// tab — pill row (not a dropdown) so the channel set and its listing counts
// are visible at a glance instead of hidden behind a click. Channel set
// comes from `channels` (GET /channels), never a hardcoded platform list,
// matching every other channel-aware view on this page. `value` is exactly
// ProductsTab's own p_channel query param ("" = all, a channel key, or
// "none" for unlisted) — this bar and that tab just share the URL, no prop
// plumbing needed between them.
export function ChannelFilterBar({
  channels,
  totalProducts,
  value,
  onChange,
  view,
  onViewChange,
  showViewToggle = true,
}: {
  channels: ChannelSummary[];
  totalProducts: number;
  value: string;
  onChange: (value: string) => void;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  showViewToggle?: boolean;
}) {
  return (
    <Card className="flex items-center gap-2 overflow-x-auto px-3 py-1.5">
      <div className="flex flex-1 items-center gap-1">
        <ChannelPill
          label="All Channels"
          count={totalProducts}
          active={value === ""}
          onClick={() => onChange("")}
        />
        {channels.map((channel) => (
          <ChannelPill
            key={channel.key}
            label={channel.name}
            count={Object.values(channel.listing_counts).reduce((a, b) => a + b, 0)}
            active={value === channel.key}
            onClick={() => onChange(channel.key)}
          />
        ))}
        <ChannelPill label="Not Listed" active={value === "none"} onClick={() => onChange("none")} />
      </div>

      {showViewToggle ? <ViewToggle value={view} onChange={onViewChange} className="shrink-0" /> : null}
    </Card>
  );
}

function ChannelPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium transition-colors",
        active ? "bg-fg text-bg" : "text-fg/60 hover:bg-bg-2 hover:text-fg",
      )}
    >
      {label}
      {count !== undefined ? (
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
            active ? "bg-bg/15 text-bg" : "bg-bg-2 text-fg/55",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
