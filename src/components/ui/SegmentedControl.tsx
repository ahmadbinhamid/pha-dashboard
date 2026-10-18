import type { ComponentType } from "react";
import { cn } from "@/utils/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  // Icon-only segment, label becomes the tooltip and accessible name.
  iconOnly?: boolean;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
  fullWidth?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
  fullWidth = false,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg bg-bg-2 p-0.5 ring-1 ring-inset ring-border",
        fullWidth && "flex w-full",
        className,
      )}
    >
      {options.map(({ value: option, label, icon: Icon, iconOnly, disabled }) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={iconOnly ? label : undefined}
            title={iconOnly ? label : undefined}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors",
              "outline-none! focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
              size === "sm" ? "h-7 text-xs" : "h-8 text-compact",
              iconOnly ? (size === "sm" ? "w-7" : "w-8") : "px-2.5",
              fullWidth && "flex-1",
              active ? "bg-card text-fg shadow-card ring-1 ring-inset ring-border" : "text-fg/45 hover:text-fg/70",
            )}
          >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            {iconOnly ? null : label}
          </button>
        );
      })}
    </div>
  );
}
