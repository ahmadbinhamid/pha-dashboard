import { Minus, Plus } from "lucide-react";
import { cn } from "@/utils/cn";

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  // null = no cap (unlimited/untracked stock)
  max?: number | null;
  className?: string;
}

export function QuantityStepper({ value, onChange, min = 1, max = null, className }: QuantityStepperProps) {
  const atMin = value <= min;
  const atMax = max != null && value >= max;

  return (
    <div className={cn("inline-flex items-center rounded-xs border border-border", className)}>
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={atMin}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-8 w-8 items-center justify-center text-fg/60 transition hover:bg-bg-2 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-9 text-center text-sm tabular-nums text-fg">{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={atMax}
        onClick={() => onChange(max != null ? Math.min(max, value + 1) : value + 1)}
        className="flex h-8 w-8 items-center justify-center text-fg/60 transition hover:bg-bg-2 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
