"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export type InputSize = "sm" | "md" | "lg";
export type InputVariant = "default" | "ghost" | "filled";

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: InputSize;
  variant?: InputVariant;
};

const inputSizes: Record<InputSize, string> = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-10 px-3 text-sm",
  lg: "h-12 px-4 text-base",
};

const inputVariants: Record<InputVariant, string> = {
  default: "border border-border bg-bg text-fg shadow-sm",
  ghost: "border border-transparent bg-transparent text-fg hover:bg-bg-2/50",
  filled: "border border-transparent bg-bg-2 text-fg",
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, size = "md", variant = "default", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-lg outline-none transition",
        "placeholder:text-fg/45",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:cursor-not-allowed disabled:opacity-50",
        inputSizes[size],
        inputVariants[variant],
        className,
      )}
      {...props}
    />
  );
});
