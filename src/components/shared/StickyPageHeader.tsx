import { cn } from "@/utils/cn";

interface StickyPageHeaderProps {
  className?: string;
  children: React.ReactNode;
  // Lets a page measure the header to place its own sticky content below it.
  ref?: React.Ref<HTMLDivElement>;
}

// Full-bleed header pinned flush to the top; offsets cancel AppShell padding.
export function StickyPageHeader({ className, children, ref }: StickyPageHeaderProps) {
  return (
    <div
      ref={ref}
      className={cn(
        "sticky -top-section z-30 -mx-4 -mt-section bg-bg px-4 pt-section sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10",
        className,
      )}
    >
      {children}
    </div>
  );
}
