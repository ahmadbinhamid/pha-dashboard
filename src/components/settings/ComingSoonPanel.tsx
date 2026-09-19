import { Hammer, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// Stands in for a settings area the product doesn't have a backend for yet.
// It deliberately shows no inputs at all: a disabled-looking form implies the
// data is there and merely locked, whereas nothing here is stored or applied.
// What it does show is what the area will cover, so the tab isn't a dead end.
export function ComingSoonPanel({
  title,
  summary,
  planned = [],
}: {
  title: string;
  summary?: string;
  planned?: string[];
}) {
  return (
    <Card className="p-8 sm:p-10">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <Hammer className="h-5 w-5" />
        </span>

        <Badge variant="muted" className="mt-4">
          Coming soon
        </Badge>

        <h2 className="mt-3 text-lg font-bold text-fg">{title}</h2>
        {summary ? <p className="mt-2 text-sm leading-relaxed text-fg/60">{summary}</p> : null}

        {planned.length > 0 ? (
          <div className="mt-6 w-full rounded-xl border border-border bg-muted/40 p-4 text-left">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-fg/50">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              What this will cover
            </div>
            <ul className="mt-3 space-y-2">
              {planned.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-fg/70">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
