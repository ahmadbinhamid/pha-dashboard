import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/utils/cn";

export type StatTileTone = "neutral" | "ok" | "danger" | "accent";

const CAPTION_TONE: Record<StatTileTone, string> = {
  neutral: "text-fg/45",
  ok: "text-ok",
  danger: "text-danger",
  accent: "text-accent",
};

// Small "label / value / caption" tile used across dashboard chart cards (RevenueTrendChart's summary row, OrderVolumeChart's footer, a borderless "plain" variant) so consumers stop hand-rolling the same markup.
export function DashboardStatTile({
  label,
  value,
  caption,
  captionTone = "neutral",
  variant = "boxed",
  loading,
  className,
}: {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  captionTone?: StatTileTone;
  variant?: "boxed" | "soft" | "plain";
  loading?: boolean;
  className?: string;
}) {
  const box =
    variant === "boxed"
      ? "rounded-xl border border-border bg-muted/50 p-3.5 hover:bg-muted/70"
      : variant === "soft"
        ? "rounded-2xl bg-muted/60 px-4 py-2.5 hover:bg-muted/80"
        : false;

  const valueSize = variant === "soft" ? "text-xl" : "text-lg";
  const valueSpacing = variant === "soft" ? "mt-0.5" : "mt-1";

  // min-w-0: grid items default to min-width: auto, so without it a long value/caption widens the grid track instead of letting `truncate` ellipsize.
  if (loading) {
    return (
      <div className={cn("min-w-0 transition-colors duration-200", box, className)}>
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-5 w-16" />
        <Skeleton className="mt-1.5 h-2.5 w-24" />
      </div>
    );
  }

  return (
    <div className={cn("min-w-0 transition-colors duration-200", box, className)}>
      <p className="truncate text-[11px] font-medium text-fg/50">{label}</p>
      <p className={cn("truncate font-bold tracking-tight text-fg tabular-nums", valueSize, valueSpacing)}>{value}</p>
      {caption ? (
        <p className={cn("mt-0.5 truncate text-[10px] font-medium", CAPTION_TONE[captionTone])}>{caption}</p>
      ) : null}
    </div>
  );
}
