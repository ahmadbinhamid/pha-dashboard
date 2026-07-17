
import { Input } from "@/components/ui/input";
import { NativeSelect as Select } from "@/components/ui/select";
import { Icons } from "@/components/ui/icons";
import { MAKES } from "@/config/vehicle-makes";
import type { EbayFilter, InventorySearchQuery } from "@/config/inventory-filters";

type Props = {
  value: InventorySearchQuery;
  onChange: (patch: Partial<InventorySearchQuery>) => void;
  categories: string[];
  /** When false, omit the leading full-width search row (e.g. dashboard shows its own). */
  showQueryField?: boolean;
  queryId?: string;
};

export function InventorySearchFields({
  value,
  onChange,
  categories,
  showQueryField = true,
  queryId,
}: Props) {
  return (
    <div className="space-y-4">
      {showQueryField ? (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg/40">
            <Icons.Search />
          </span>
          <Input
            id={queryId}
            value={value.q}
            onChange={(e) => onChange({ q: e.target.value })}
            className="h-11 pl-10 text-[15px]"
            placeholder="Title, SKU, category, ID…"
            aria-label="Inventory keyword search"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-fg/50">Make</label>
          <Select value={value.make} onChange={(e) => onChange({ make: e.target.value })}>
            <option value="">Any make</option>
            {MAKES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-fg/50">Model</label>
          <Input
            value={value.model}
            onChange={(e) => onChange({ model: e.target.value })}
            className="h-10"
            placeholder="e.g. C-Class W205"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-fg/50">Year</label>
          <Input
            value={value.year}
            onChange={(e) => onChange({ year: e.target.value })}
            className="h-10"
            placeholder="e.g. 2018"
            inputMode="numeric"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-fg/50">Category</label>
          <Select value={value.category} onChange={(e) => onChange({ category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-fg/50">eBay status</label>
          <Select value={value.ebay} onChange={(e) => onChange({ ebay: e.target.value as EbayFilter })}>
            <option value="all">All</option>
            <option value="synced">Synced</option>
            <option value="pending">Pending</option>
            <option value="error">Error</option>
            <option value="not_listed">Not listed</option>
          </Select>
        </div>
      </div>
    </div>
  );
}
