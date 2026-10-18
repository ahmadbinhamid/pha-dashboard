import { cn } from "@/utils/cn";

interface FormSubsectionProps {
  title: string;
  // Draws a rule above, for stacked groups inside one card or modal.
  divided?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Small-caps titled group of fields within a form card. */
export function FormSubsection({ title, divided = false, className, children }: FormSubsectionProps) {
  return (
    <section className={cn("space-y-4", divided && "border-t border-border pt-5", className)}>
      <p className="text-xs font-semibold tracking-wide text-fg/55 uppercase">{title}</p>
      {children}
    </section>
  );
}
