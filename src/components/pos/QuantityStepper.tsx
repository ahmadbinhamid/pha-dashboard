import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/utils/cn";

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  // null = no cap (unlimited/untracked stock)
  max?: number | null;
  // Lets the count be typed too; commits on blur or Enter.
  editable?: boolean;
  disabled?: boolean;
  className?: string;
}

export function QuantityStepper({ value, onChange, min = 1, max = null, editable = false, disabled, className }: QuantityStepperProps) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const clamp = (n: number) => Math.max(min, max != null ? Math.min(max, n) : n);
  const atMin = value <= min;
  const atMax = max != null && value >= max;

  function commit() {
    const n = clamp(Math.floor(Number(draft)) || min);
    setDraft(String(n));
    if (n !== value) onChange(n);
  }

  return (
    <div className={cn("inline-flex items-center overflow-hidden rounded-xs border border-border", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Decrease quantity"
        disabled={disabled || atMin}
        onClick={() => onChange(clamp(value - 1))}
        className="h-8 w-8 rounded-none text-fg/60"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      {editable ? (
        <Input
          // Text + numeric keypad: no native spinner beside the -/+ buttons.
          type="text"
          inputMode="numeric"
          variant="ghost"
          size="sm"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          aria-label="Quantity"
          className="h-8 w-12 rounded-none px-1 text-center text-sm tabular-nums"
        />
      ) : (
        <span className="w-9 text-center text-sm tabular-nums text-fg">{value}</span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Increase quantity"
        disabled={disabled || atMax}
        onClick={() => onChange(clamp(value + 1))}
        className="h-8 w-8 rounded-none text-fg/60"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
