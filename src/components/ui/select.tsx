"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export type SelectSize = "sm" | "md" | "lg";

export type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  size?: SelectSize;
};

const selectSizes: Record<SelectSize, string> = {
  sm: "h-8 px-2.5 pr-7 text-xs",
  md: "h-10 px-3 pr-8 text-sm",
  lg: "h-12 px-4 pr-9 text-base",
};

const chevronUrl =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, size = "md", children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      style={{ backgroundImage: chevronUrl, backgroundPosition: "right 0.75rem center", backgroundRepeat: "no-repeat" }}
      className={cn(
        "w-full appearance-none rounded-lg border border-border bg-bg text-fg shadow-sm outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:pointer-events-none disabled:opacity-50",
        selectSizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
