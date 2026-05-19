"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { InventoryItem } from "@/lib/data/inventory";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icons } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClassName } from "@/components/ui/button-styles";
import { useToast } from "@/components/toast/toast-provider";
import { useInventoryData } from "@/components/inventory/inventory-store";
import { useCounterCartActions } from "@/components/counter/counter-cart-store";
import { MAKES } from "@/lib/store/data/catalog";
import {
  inventoryFiltersFromSearchParams,
  type EbayFilter,
  type InventoryListView,
} from "@/lib/inventory-list-url";

function EbayBadge({ status }: { status: InventoryItem["ebay"] }) {
  if (status === "synced") return <Badge variant="ok">Synced</Badge>;
  if (status === "pending") return <Badge variant="warn">Pending</Badge>;
  if (status === "error") return <Badge variant="danger">Error</Badge>;
  return <Badge variant="muted">Not listed</Badge>;
}

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <Badge variant="danger">Out · 0</Badge>;
  if (stock <= 15) return <Badge variant="warn">Low · {stock}</Badge>;
  return <Badge variant="ok">In stock · {stock}</Badge>;
}

function ProductAvatar({ item }: { item: InventoryItem }) {
  const bg = `hsl(${item.image.hue} 90% 45% / 0.14)`;
  const ring = `hsl(${item.image.hue} 90% 55% / 0.25)`;
  return (
    <div
      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-semibold text-fg/80 ring-1 ring-inset"
      style={{ backgroundColor: bg, borderColor: ring }}
    >
      {item.image.initials}
    </div>
  );
}

function ProductTileHero({ item }: { item: InventoryItem }) {
  const g1 = `hsl(${item.image.hue} 78% 38% / 0.55)`;
  const g2 = `hsl(${item.image.hue} 55% 18% / 0.75)`;
  return (
    <div
      className="relative aspect-5/4 overflow-hidden bg-bg-2"
      style={{ backgroundImage: `linear-gradient(155deg, ${g1}, ${g2})` }}
    >
      <div
        className="absolute inset-0 opacity-90"
        style={{
          backgroundImage: `radial-gradient(circle at 28% 22%, rgba(255,255,255,0.22), transparent 42%)`,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="select-none text-5xl font-bold tracking-tight text-white/95 drop-shadow-lg sm:text-6xl">
          {item.image.initials}
        </span>
      </div>
    </div>
  );
}

type Filters = {
  query: string;
  category: string;
  ebay: EbayFilter;
  make: string;
  model: string;
  year: string;
  view: InventoryListView;
};

function filtersFromParams(sp: ReturnType<typeof useSearchParams>): Filters {
  const f = inventoryFiltersFromSearchParams(sp);
  return { query: f.q, category: f.category, ebay: f.ebay, make: f.make, model: f.model, year: f.year, view: f.view };
}

export function InventoryTable() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(searchParams));
  // Separate display query so typing feels instant; filter computation is debounced
  const [inputQuery, setInputQuery] = useState(() => filtersFromParams(searchParams).query);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const { items: inventory } = useInventoryData();
  const { addLine } = useCounterCartActions();
  const router = useRouter();

  const { category, ebay, make, model, year, view } = filters;

  // Sync filters and input when URL changes (e.g. navigating back/forward)
  useEffect(() => {
    const f = filtersFromParams(searchParams);
    setFilters(f);
    setInputQuery(f.query);
    setPage(1);
  }, [searchParams]);

  // Debounce: apply text search to the filter 200ms after typing stops
  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((f) => {
        if (f.query === inputQuery) return f;
        return { ...f, query: inputQuery };
      });
      setPage(1);
    }, 200);
    return () => clearTimeout(id);
  }, [inputQuery]);

  const categories = useMemo(
    () => [...new Set(inventory.map((p) => p.category))].sort((a, b) => a.localeCompare(b)),
    [inventory],
  );

  const yearNum = useMemo(() => {
    const n = parseInt(year.trim(), 10);
    return Number.isFinite(n) ? n : NaN;
  }, [year]);
  const hasYear = !Number.isNaN(yearNum);

  const { query } = filters;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const m = make.trim().toLowerCase();
    const mo = model.trim().toLowerCase();
    return inventory.filter((p) => {
      const hay = `${p.title} ${p.sku} ${p.category} ${p.id} ${p.make} ${p.model}`.toLowerCase();
      const matchesQuery = !q || hay.includes(q);
      const matchesEbay = ebay === "all" ? true : p.ebay === ebay;
      const matchesCategory = !category.trim() || p.category === category;
      const matchesMake = !m || p.make.toLowerCase() === m;
      const matchesModel = !mo || p.model.toLowerCase().includes(mo);
      const matchesYear = !hasYear || (yearNum >= p.yearFrom && yearNum <= p.yearTo);
      return matchesQuery && matchesEbay && matchesCategory && matchesMake && matchesModel && matchesYear;
    });
  }, [query, ebay, category, make, model, hasYear, yearNum, inventory]);

  const pageSize = view === "tiles" ? 9 : 6;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(pageCount, Math.max(1, page));
  const items = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([id]) => id),
    [selected],
  );

  const allOnPageSelected = items.length > 0 && items.every((p) => selected[p.id]);

  const onCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((f) => ({ ...f, category: e.target.value }));
    setPage(1);
  }, []);

  const onEbayChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((f) => ({ ...f, ebay: e.target.value as EbayFilter }));
    setPage(1);
  }, []);

  const onMakeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((f) => ({ ...f, make: e.target.value }));
    setPage(1);
  }, []);

  const onModelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((f) => ({ ...f, model: e.target.value }));
    setPage(1);
  }, []);

  const onYearChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((f) => ({ ...f, year: e.target.value }));
    setPage(1);
  }, []);

  const onSelectAllPage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...selected };
    items.forEach((row) => (next[row.id] = e.target.checked));
    setSelected(next);
  }, [selected, items]);

  return (
    <Card>
      <CardHeader
        title="Products"
        description="Search warehouse stock by keyword, vehicle fitment, category, and eBay state."
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex rounded-lg border border-border bg-bg-2/40 p-0.5">
              <Button
                type="button"
                variant={view === "table" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 gap-1.5 px-2.5"
                onClick={() => { setFilters((f) => ({ ...f, view: "table" })); setPage(1); }}
              >
                <Icons.Bars className="h-3.5 w-3.5 opacity-70" aria-hidden />
                Table
              </Button>
              <Button
                type="button"
                variant={view === "tiles" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 gap-1.5 px-2.5"
                onClick={() => { setFilters((f) => ({ ...f, view: "tiles" })); setPage(1); }}
              >
                <Icons.Box className="h-3.5 w-3.5 opacity-70" aria-hidden />
                Tiles
              </Button>
            </div>
            {selectedIds.length ? (
              <Button
                variant="secondary"
                size="sm"
                title="Bulk action"
                onClick={() =>
                  toast({
                    tone: "default",
                    title: "Bulk actions",
                    description: `Selected ${selectedIds.length} item(s). (Demo)`,
                  })
                }
              >
                Bulk ({selectedIds.length})
              </Button>
            ) : null}
          </div>
        }
      />

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full min-w-0">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg/45">
              <Icons.Search />
            </span>
            <Input
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              className="pl-9"
              placeholder="Search title, SKU, category, ID, make, model…"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="text-xs font-semibold text-fg/55">Category</div>
              <div className="relative min-w-35">
                <select
                  className="h-10 w-full appearance-none rounded-lg border border-border bg-bg px-3 pr-9 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  value={category}
                  onChange={onCategoryChange}
                >
                  <option value="">All</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-fg/50">
                  <Icons.ChevronDown />
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs font-semibold text-fg/55">eBay</div>
              <div className="relative">
                <select
                  className="h-10 appearance-none rounded-lg border border-border bg-bg px-3 pr-9 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  value={ebay}
                  onChange={onEbayChange}
                >
                  <option value="all">All</option>
                  <option value="synced">Synced</option>
                  <option value="pending">Pending</option>
                  <option value="error">Error</option>
                  <option value="not_listed">Not listed</option>
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-fg/50">
                  <Icons.ChevronDown />
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-fg/50">Make</label>
            <select
              className="h-10 w-full appearance-none rounded-lg border border-border bg-bg px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              value={make}
              onChange={onMakeChange}
            >
              <option value="">Any</option>
              {MAKES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-fg/50">Model</label>
            <Input
              value={model}
              onChange={onModelChange}
              placeholder="e.g. C-Class W205"
              className="h-10"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-fg/50">Year</label>
            <Input
              value={year}
              onChange={onYearChange}
              placeholder="Fits this model year"
              inputMode="numeric"
              className="h-10"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="No results"
            description="Try adjusting your search terms or filters. You can also add a new product to get started."
            actionLabel="Add product"
            actionHref="/inventory/new"
          />
        ) : view === "tiles" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((p) => (
              <div
                key={p.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm ring-1 ring-inset ring-border/40 transition hover:border-accent/35 hover:shadow-md"
              >
                <div className="relative">
                  <label
                    className="absolute left-3 top-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-white/25 bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={!!selected[p.id]}
                      onChange={(e) => {
                        e.stopPropagation();
                        setSelected((s) => ({ ...s, [p.id]: e.target.checked }));
                      }}
                      className="h-4 w-4 rounded border-white/40"
                    />
                  </label>
                  <Link
                    href={`/products/${p.id}`}
                    className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  >
                    <ProductTileHero item={p} />
                  </Link>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <Link href={`/products/${p.id}`} className="min-w-0 focus:outline-none focus-visible:underline">
                    <h3 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight text-fg group-hover:text-accent">{p.title}</h3>
                  </Link>
                  <p className="mt-1 font-mono text-xs text-fg/55">{p.sku}</p>
                  <p className="mt-2 text-xs text-fg/60">
                    <span className="font-medium text-fg/75">{p.make}</span> · {p.model}
                    <span className="text-fg/45">
                      {" "}
                      · {p.yearFrom}–{p.yearTo}
                    </span>
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {p.category}
                    </Badge>
                    <StockBadge stock={p.stock} />
                    <EbayBadge status={p.ebay} />
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-border/60 pt-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-fg/45">Price</div>
                      <div className="text-lg font-semibold tabular-nums text-fg">{formatCurrency(p.price)}</div>
                      <div className="text-xs text-fg/50">Cost {formatCurrency(p.cost)}</div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        className="min-w-22"
                        onClick={() => {
                          addLine(
                            { productId: p.id, sku: p.sku, title: p.title, unitPriceInclGst: p.price },
                            1,
                          );
                          toast({ tone: "success", title: "Added to cart", description: p.title });
                        }}
                      >
                        Add
                      </Button>
                      <Link
                        href={`/products/${p.id}`}
                        className={buttonClassName({
                          variant: "secondary",
                          size: "sm",
                          className: "inline-flex justify-center gap-1 font-semibold",
                        })}
                      >
                        View
                        <Icons.ChevronRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-bg-2/60">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={onSelectAllPage}
                      />
                      Product
                    </label>
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg/55">SKU</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg/55">Vehicle</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg/55">Category</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg/55">Stock</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-fg/55">Cost</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-fg/55">Price</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg/55">eBay</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-bg">
                {items.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer transition-colors hover:bg-bg-2/40"
                    onClick={(e) => {
                      const t = e.target as HTMLElement;
                      if (t.closest("a,button,input,label")) return;
                      router.push(`/products/${p.id}`);
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!!selected[p.id]}
                          onChange={(e) => setSelected((s) => ({ ...s, [p.id]: e.target.checked }))}
                        />
                        <ProductAvatar item={p} />
                        <div className="min-w-0">
                          <Link href={`/products/${p.id}`} className="truncate text-sm font-semibold hover:underline">
                            {p.title}
                          </Link>
                          <div className="truncate text-xs text-fg/60">
                            {p.make} {p.model} · {p.yearFrom}–{p.yearTo}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-fg/75">{p.sku}</td>
                    <td className="max-w-[16rem] px-4 py-3 text-sm text-fg/75">
                      <div className="truncate" title={`${p.make} ${p.model}`}>
                        {p.make} {p.model}
                      </div>
                      <div className="text-xs text-fg/50">
                        {p.yearFrom}–{p.yearTo}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-fg/75">{p.category}</td>
                    <td className="px-4 py-3">
                      <StockBadge stock={p.stock} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-fg/75">{formatCurrency(p.cost)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">{formatCurrency(p.price)}</td>
                    <td className="px-4 py-3">
                      <EbayBadge status={p.ebay} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          addLine(
                            { productId: p.id, sku: p.sku, title: p.title, unitPriceInclGst: p.price },
                            1,
                          );
                          toast({ tone: "success", title: "Added to cart", description: p.title });
                        }}
                      >
                        Add
                      </Button>
                      <Link
                        href={`/products/${p.id}`}
                        className={buttonClassName({
                          variant: "ghost",
                          size: "sm",
                          className: "inline-flex gap-1 font-semibold text-accent hover:text-accent",
                        })}
                        onClick={(e) => e.stopPropagation()}
                      >
                        View
                        <Icons.ChevronRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-fg/60">
            Page <span className="font-semibold text-fg">{safePage}</span> of{" "}
            <span className="font-semibold text-fg">{pageCount}</span> ·{" "}
            <span className="font-semibold text-fg">{filtered.length}</span> items
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((pg) => Math.max(1, pg - 1))}
              disabled={safePage === 1}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((pg) => Math.min(pageCount, pg + 1))}
              disabled={safePage === pageCount}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
