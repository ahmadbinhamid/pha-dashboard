import { Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/utils/cn";

export interface EssentialItem {
  key: string;
  label: string;
  done: boolean;
  // Shown only while not done, e.g. "Add" / "Upload".
  action?: { label: string; onClick: () => void };
}

// What a product still needs; each missing item links to its field.
export function ProductEssentialsCard({ items }: { items: EssentialItem[] }) {
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? (done / items.length) * 100 : 0;

  return (
    <Card>
      <div className="flex items-center gap-2 px-4 pt-3">
        <svg viewBox="0 0 36 36" className="h-5 w-5 -rotate-90" aria-hidden="true">
          <circle cx="18" cy="18" r="15" fill="none" strokeWidth="5" className="stroke-accent/20" />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            strokeWidth="5"
            strokeDasharray={`${(pct / 100) * 94.2} 94.2`}
            className="stroke-accent"
          />
        </svg>
        <h4 className="text-sm font-semibold text-fg">Essentials</h4>
        <span className="ml-auto text-xs text-fg/45">
          {done} of {items.length}
        </span>
      </div>
      <ul className="px-4 pb-3 pt-1">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2 py-1.5 text-sm">
            {item.done ? <Check className="h-3.5 w-3.5 text-ok" /> : <Circle className="h-3.5 w-3.5 text-fg/35" />}
            <span className={cn(item.done && "text-fg/50 line-through")}>{item.label}</span>
            {!item.done && item.action && (
              <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs text-accent" onClick={item.action.onClick}>
                {item.action.label}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
