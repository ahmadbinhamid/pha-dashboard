"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export type TextareaSize = "sm" | "md" | "lg";
export type TextareaVariant = "default" | "ghost" | "filled";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  size?: TextareaSize;
  variant?: TextareaVariant;
};

const textareaSizes: Record<TextareaSize, string> = {
  sm: "min-h-[80px] px-2.5 py-1.5 text-xs",
  md: "min-h-[120px] px-3 py-2.5 text-sm",
  lg: "min-h-[160px] px-4 py-3 text-base",
};

const textareaVariants: Record<TextareaVariant, string> = {
  default: "border border-border bg-bg text-fg shadow-sm",
  ghost: "border border-transparent bg-transparent text-fg hover:bg-bg-2/50",
  filled: "border border-transparent bg-bg-2 text-fg",
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, size = "md", variant = "default", ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg outline-none transition resize-y",
        "placeholder:text-fg/45",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:cursor-not-allowed disabled:opacity-50",
        textareaSizes[size],
        textareaVariants[variant],
        className,
      )}
      {...props}
    />
  );
});
