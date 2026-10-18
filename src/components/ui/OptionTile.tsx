import { Check } from "lucide-react";
import { cn } from "@/utils/cn";

interface OptionTileProps {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  // Shows the corner check badge when selected.
  showCheck?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** One selectable card in a radio-style tile grid (presets, themes, …). */
export function OptionTile({ selected, onSelect, disabled, showCheck = true, className, children }: OptionTileProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "group relative overflow-hidden rounded-lg border-2 bg-card text-left transition-colors disabled:opacity-50",
        "outline-none! focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        selected ? "border-accent" : "border-border hover:border-fg/25",
        className,
      )}
    >
      {children}
      {showCheck && selected ? (
        <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-fg">
          <Check className="h-3 w-3" />
        </span>
      ) : null}
    </button>
  );
}
