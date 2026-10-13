import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/utils/cn";

interface ProductSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  activeFilterCount: number;
  onOpenFilters: () => void;
}

// Plain text search; the filter icon opens the vehicle filter modal.
export function ProductSearchField({ value, onChange, activeFilterCount, onOpenFilters }: ProductSearchFieldProps) {
  const filterLabel = activeFilterCount ? `Vehicle filters, ${activeFilterCount} applied` : "Vehicle filters";

  return (
    <div className="relative w-full sm:w-80">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
      <Input placeholder="Search products…" value={value} onChange={(e) => onChange(e.target.value)} className="pl-9 pr-11" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-lg", activeFilterCount ? "text-accent" : "text-fg/50")}
        onClick={onOpenFilters}
        aria-label={filterLabel}
        title={filterLabel}
      >
        <SlidersHorizontal className="h-4 w-4" />
        {activeFilterCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-3xs font-semibold text-accent-fg">
            {activeFilterCount}
          </span>
        )}
      </Button>
    </div>
  );
}
