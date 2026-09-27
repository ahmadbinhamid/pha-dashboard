
import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/utils/cn";

export type CheckboxSize = "sm" | "md" | "lg";

export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  label?: React.ReactNode;
  description?: React.ReactNode;
  size?: CheckboxSize;
};

const checkboxSizes: Record<CheckboxSize, { input: string; icon: string; label: string; desc: string }> = {
  sm: { input: "h-3.5 w-3.5", icon: "h-2.5 w-2.5", label: "text-xs", desc: "text-xs" },
  md: { input: "h-4 w-4", icon: "h-3 w-3", label: "text-sm", desc: "text-xs" },
  lg: { input: "h-5 w-5", icon: "h-3.5 w-3.5", label: "text-base", desc: "text-sm" },
};

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, label, description, id, size = "md", ...props },
  ref,
) {
  // useId() must run unconditionally — calling it inside `id ?? useId()` was a rules-of-hooks violation if `id` toggled between set/unset across renders.
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const s = checkboxSizes[size];

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-5 items-center">
        {/* appearance-none + overlaid Check icon: native accent-color ticks render black on light accent colors in some browsers, so we draw our own to guarantee white. */}
        <div className="relative inline-flex">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            className={cn(
              "peer appearance-none rounded-sm border border-border bg-bg shadow-sm outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "checked:border-accent checked:bg-accent",
              s.input,
              className,
            )}
            {...props}
          />
          <Check
            className={cn(
              "pointer-events-none absolute inset-0 m-auto hidden text-white peer-checked:block",
              s.icon,
            )}
            strokeWidth={3}
            aria-hidden="true"
          />
        </div>
      </div>
      {(label || description) ? (
        <div className="min-w-0">
          {label ? (
            <label htmlFor={inputId} className={cn("cursor-pointer select-none font-medium text-fg", s.label)}>
              {label}
            </label>
          ) : null}
          {description ? (
            <p className={cn("mt-0.5 text-fg/55", s.desc)}>{description}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
