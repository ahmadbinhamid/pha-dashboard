import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DESIGN_LIMITS } from "@/config/emailBuilder";
import { getProducts } from "@/lib/api/products";
import { moveItem } from "@/lib/campaigns/emailDesign";
import { formatCurrency } from "@/utils/format";
import type { ProductItem } from "@/types/campaign";
import type { Product } from "@/types/product";

interface EmailProductPickerProps {
  items: ProductItem[];
  onChange: (items: ProductItem[]) => void;
}

const SEARCH_DEBOUNCE_MS = 350;
const RESULTS_LIMIT = 8;

// A snapshot, so the email stays as designed if the product changes later.
const toItem = (p: Product): ProductItem => ({
  product_id: p._id,
  title: p.title,
  price_label: formatCurrency(p.price),
  image: p.attachments?.[0]?.url ?? "",
  url: `/product/${p.slug}`,
});

export function EmailProductPicker({ items, onChange }: EmailProductPickerProps) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  const { data, isFetching } = useQuery({
    queryKey: ["products", "email-picker", search],
    queryFn: () => getProducts({ search, status: "active", page: 1, limit: RESULTS_LIMIT }),
  });
  const results = data?.data?.items ?? [];
  const picked = new Set(items.map((i) => i.product_id));
  const full = items.length >= DESIGN_LIMITS.maxProducts;

  return (
    <div className="space-y-3">
      {items.length ? (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={`${item.product_id}-${i}`} className="flex items-center gap-2 rounded-lg border border-border p-1.5">
              {item.image ? <img src={item.image} alt="" className="h-9 w-9 shrink-0 rounded object-cover" /> : null}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-fg">{item.title}</div>
                <div className="text-2xs text-fg/50">{item.price_label}</div>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Move up" disabled={i === 0} onClick={() => onChange(moveItem(items, i, i - 1))}>
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label="Move down"
                disabled={i === items.length - 1}
                onClick={() => onChange(moveItem(items, i, i + 1))}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
        <Input size="sm" className="pl-9" placeholder="Search products…" value={input} onChange={(e) => setInput(e.target.value)} />
      </div>
      {full ? <p className="text-xs text-fg/55">Up to {DESIGN_LIMITS.maxProducts} products per block.</p> : null}
      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {results.map((p) => (
          <li key={p._id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-bg-2">
            {p.attachments?.[0]?.url ? <img src={p.attachments[0].url} alt="" className="h-8 w-8 shrink-0 rounded object-cover" /> : null}
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs text-fg">{p.title}</div>
              <div className="text-2xs text-fg/50">{formatCurrency(p.price)}</div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label={`Add ${p.title}`}
              disabled={full || picked.has(p._id)}
              onClick={() => onChange([...items, toItem(p)])}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
        {!results.length && !isFetching ? <li className="px-1.5 text-xs text-fg/50">No products found.</li> : null}
      </ul>
    </div>
  );
}
