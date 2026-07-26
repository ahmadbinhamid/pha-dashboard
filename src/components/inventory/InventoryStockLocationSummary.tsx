import { cn } from "@/utils/cn";

interface InventoryStockLocationSummaryProps {
  locationName: string;
  currentLabel?: string;
  current: number;
  /** When provided, renders a "→ {nextLabel}" column next to Current — used
   * by Adjust Stock once a non-zero adjustment is entered. */
  next?: number;
  nextLabel?: string;
}

// Shared "Location / stock count" info box used by both Adjust Stock and Set
// Stock — previously each dialog reimplemented this inline.
export function InventoryStockLocationSummary({
  locationName,
  currentLabel = "Current",
  current,
  next,
  nextLabel = "New",
}: InventoryStockLocationSummaryProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xs border border-border bg-bg-2/40 p-3">
      <div>
        <p className="text-xs text-fg/45">Location</p>
        <p className="text-sm font-medium text-fg">{locationName}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-xs text-fg/45">{currentLabel}</p>
          <p className="text-lg font-semibold text-fg">{current}</p>
        </div>
        {next !== undefined && (
          <>
            <span className="text-fg/30">→</span>
            <div className="text-right">
              <p className="text-xs text-fg/45">{nextLabel}</p>
              <p className={cn("text-lg font-semibold", next < 0 ? "text-danger" : "text-fg")}>{next}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
