import { cn } from "@/utils/cn";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  id?: string;
  ariaLabel?: string;
  // Formats the readout beside the track, e.g. (v) => `${v}%`.
  formatValue?: (value: number) => string;
  disabled?: boolean;
  className?: string;
}

export function Slider({ value, onChange, min, max, step = 1, id, ariaLabel, formatValue, disabled, className }: SliderProps) {
  return (
    <div className={cn("flex h-10 items-center gap-3", className)}>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "w-full cursor-pointer accent-accent disabled:opacity-50",
          "outline-none! focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        )}
      />
      {formatValue ? <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-fg/70">{formatValue(value)}</span> : null}
    </div>
  );
}
