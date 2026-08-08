import { Card } from "@/components/ui/Card";
import { cn } from "@/utils/cn";

export function MetricCard({
  label,
  value,
  subLabel,
  icon,
  loading,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  subLabel?: React.ReactNode;
  icon: React.ReactNode;
  loading?: boolean;
  onClick?: () => void;
}) {
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
        "p-4 sm:p-5",
        onClick && "cursor-pointer transition hover:ring-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
      )}
    >
      <div className="flex items-center gap-2 text-fg/55">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xs bg-bg-2 text-fg/60">
          {icon}
        </span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div
        className={cn(
          "mt-3 text-2xl font-semibold tracking-tight text-fg tabular-nums",
          loading && "animate-pulse text-fg/30",
        )}
      >
        {loading ? "—" : value}
      </div>
      {subLabel ? <div className="mt-1 text-xs text-fg/50">{subLabel}</div> : null}
    </Card>
  );
}
