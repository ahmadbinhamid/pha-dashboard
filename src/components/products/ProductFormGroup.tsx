import { cn } from "@/utils/cn";

interface ProductFormGroupProps {
  title: React.ReactNode;
  // Right-aligned note, e.g. "All amounts in A$".
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

// A titled group inside one card; the card's divide-y draws the hairlines.
export function ProductFormGroup({ title, aside, className, children }: ProductFormGroupProps) {
  return (
    <section className={cn("flex flex-col gap-4 p-5", className)}>
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {aside && <span className="ml-auto text-xs text-fg/45">{aside}</span>}
      </div>
      {children}
    </section>
  );
}
