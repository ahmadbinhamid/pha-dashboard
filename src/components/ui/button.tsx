"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "@/components/ui/button-styles";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={buttonClassName({ variant, size, className })}
      {...props}
    />
  );
});

