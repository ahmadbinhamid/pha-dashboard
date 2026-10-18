import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/utils/cn";

interface DisclosureProps {
  title: React.ReactNode;
  // One-line recap of the current setting, shown beside the title.
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Collapsible card section, so optional settings stay out of the way. */
export function Disclosure({ title, summary, defaultOpen = false, className, children }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  return (
    <Card className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5",
          "outline-none! focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        )}
      >
        <span className="text-sm font-semibold text-fg">{title}</span>
        <span className="flex min-w-0 items-center gap-2">
          {summary ? <span className="truncate text-xs text-fg/55">{summary}</span> : null}
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-fg/45 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open ? (
        <div id={contentId} className="space-y-4 border-t border-border px-4 py-4 sm:px-5">
          {children}
        </div>
      ) : null}
    </Card>
  );
}
