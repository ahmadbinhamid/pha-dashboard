import * as React from "react";
import { cn } from "@/utils/cn";

export type SwitchProps = {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
};

export function Switch({
  id,
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  className,
}: SwitchProps) {
  const innerId = React.useId();
  const switchId = id ?? innerId;

  return (
    <div className={cn("flex items-start justify-between gap-4 rounded-xl border border-border bg-bg-2/40 px-4 py-3", className)}>
      {(label || description) ? (
        <div className="min-w-0">
          {label ? (
            <label htmlFor={switchId} className="cursor-pointer text-sm font-medium text-fg">
              {label}
            </label>
          ) : null}
          {description ? (
            <p className="mt-0.5 text-xs text-fg/55">{description}</p>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        id={switchId}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          "disabled:pointer-events-none disabled:opacity-50",
          checked ? "bg-accent" : "bg-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
            checked ? "left-5" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}
