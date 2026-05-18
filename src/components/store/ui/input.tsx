"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export type StoreInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const StoreInput = React.forwardRef<HTMLInputElement, StoreInputProps>(function StoreInput(
  { className, type, ...props },
  ref,
) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm ring-offset-bg file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-fg/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
