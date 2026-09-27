import * as React from "react";
import { cn } from "@/utils/cn";
import { useFieldDensity } from "@/components/ui/FieldDensity";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean;
};

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, children, required, ...props },
  ref,
) {
  const compact = useFieldDensity() === "compact";
  return (
    <label
      ref={ref}
      className={cn(
        "block font-semibold leading-none text-fg",
        compact ? "text-xs" : "text-sm",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
        className,
      )}
      {...props}
    >
      {children}
      {required ? (
        <span className="ml-1 text-danger" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
});
