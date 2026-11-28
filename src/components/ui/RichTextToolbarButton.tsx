import { forwardRef } from "react";
import { cn } from "@/utils/cn";

interface RichTextToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  title: string;
}

/** One rich-text toolbar icon button; forwards its ref for popover triggers. */
export const RichTextToolbarButton = forwardRef<HTMLButtonElement, RichTextToolbarButtonProps>(function RichTextToolbarButton(
  { active, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md transition",
        "text-fg/65 hover:bg-bg-2 hover:text-fg",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active && "bg-bg-2 text-fg ring-1 ring-inset ring-border",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
