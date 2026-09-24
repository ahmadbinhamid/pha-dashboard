import { cn } from "@/utils/cn";

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  className?: string;
}

// Small exclusive choice (e.g. New / Used): a radio group as one control.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  ...aria
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={aria["aria-label"]}
      className={cn("inline-flex h-10 items-center gap-0.5 self-start rounded-xl bg-bg-2 p-1 ring-1 ring-inset ring-border", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-full rounded-lg px-3 text-xs font-medium transition-colors outline-none! focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-accent/15 text-accent" : "text-fg/60 hover:text-fg",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
