import { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { PaletteRow } from "@/components/shell/CommandPaletteRow";
import { CommandPaletteSection } from "@/components/shell/CommandPaletteSection";
import { NAV_ITEMS } from "@/config/nav";
import { STOCK_STATUS_CONFIG } from "@/config/stockStatus";
import { getProducts } from "@/lib/api/products";
import { getOrders } from "@/lib/api/orders";
import { getCustomers } from "@/lib/api/customers";
import { formatCurrency, formatCurrencyFromCents, formatOrderNumber } from "@/utils/format";
import { cn } from "@/utils/cn";
import { Search, Package, ShoppingCart, Users, ArrowRight, X } from "lucide-react";
import type { Product } from "@/types/product";

const RESULT_LIMIT = { pages: 4, products: 5, orders: 4, customers: 4 };
const DEBOUNCE_MS = 350;

const STOCK_TEXT_TONE: Record<Product["stock_status"], string> = {
  in_stock: "text-ok",
  low_stock: "text-warn",
  out_of_stock: "text-danger",
};

function stockLabel(product: Product) {
  return product.stock_status === "out_of_stock"
    ? STOCK_STATUS_CONFIG.out_of_stock.label
    : `${product.stock_count ?? 0} in stock`;
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = query.trim();
  const hasQuery = debouncedQuery.length > 0;

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(trimmed), DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [trimmed]);

  useEffect(() => {
    setActiveIndex(0);
  }, [trimmed]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setDebouncedQuery("");
      setActiveIndex(0);
      // Focus after the dialog's own mount/animation frame.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const pageResults = useMemo(
    () =>
      trimmed
        ? NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(trimmed.toLowerCase())).slice(
            0,
            RESULT_LIMIT.pages,
          )
        : [],
    [trimmed],
  );

  const {
    data: productsRes,
    isFetching: productsLoading,
    isError: productsErrored,
  } = useQuery({
    queryKey: ["command-palette", "products", debouncedQuery],
    queryFn: () => getProducts({ search: debouncedQuery, limit: RESULT_LIMIT.products }),
    enabled: open && hasQuery,
    retry: false,
  });
  const products = productsRes?.data?.items ?? [];

  const {
    data: ordersRes,
    isFetching: ordersLoading,
    isError: ordersErrored,
  } = useQuery({
    queryKey: ["command-palette", "orders", debouncedQuery],
    queryFn: () => getOrders({ search: debouncedQuery, limit: RESULT_LIMIT.orders }),
    enabled: open && hasQuery,
    retry: false,
  });
  const orders = ordersRes?.data?.items ?? [];

  const {
    data: customersRes,
    isFetching: customersLoading,
    isError: customersErrored,
  } = useQuery({
    queryKey: ["command-palette", "customers", debouncedQuery],
    queryFn: () => getCustomers({ search: debouncedQuery, limit: RESULT_LIMIT.customers }),
    enabled: open && hasQuery,
    retry: false,
  });
  const customers = customersRes?.data?.items ?? [];

  function close() {
    onOpenChange(false);
  }

  // Flattened in the same order every section renders in, so Up/Down/Enter
  // can move across Pages → Products → Orders → Customers with one shared
  // index instead of each section owning separate keyboard state.
  const flatEntries = useMemo(() => {
    const entries: { id: string; onSelect: () => void }[] = [];
    for (const item of pageResults) {
      entries.push({ id: `page:${item.href}`, onSelect: () => { close(); navigate(item.href); } });
    }
    for (const p of products) {
      entries.push({ id: `product:${p._id}`, onSelect: () => { close(); navigate(`/products/${p.slug}/edit`); } });
    }
    for (const o of orders) {
      entries.push({ id: `order:${o._id}`, onSelect: () => { close(); navigate(`/orders/${o._id}`); } });
    }
    for (const c of customers) {
      entries.push({ id: `customer:${c._id}`, onSelect: () => { close(); navigate(`/customers/${c._id}`); } });
    }
    return entries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageResults, products, orders, customers]);

  function indexOf(id: string) {
    return flatEntries.findIndex((e) => e.id === id);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatEntries.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flatEntries[activeIndex]?.onSelect();
    }
  }

  const anyLoading = productsLoading || ordersLoading || customersLoading;
  const anyErrored = productsErrored || ordersErrored || customersErrored;
  // A section that failed to search isn't the same as one that genuinely
  // found nothing — surfacing that distinction (rather than the query
  // silently reading as an empty array) is what caught product search
  // returning zero everywhere because its backing search service was
  // unreachable, not because nothing matched.
  const noResults = hasQuery && !anyLoading && !anyErrored && flatEntries.length === 0;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-[10%] z-50 flex max-h-[76vh] w-[min(92vw,42rem)] -translate-x-1/2 flex-col",
            "overflow-hidden rounded-xl border border-border bg-bg shadow-2xl",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
          onKeyDown={handleKeyDown}
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <div className="shrink-0 border-b border-border p-3">
            {/* A plain `outline-none` on the input loses to this app's global,
                unlayered :focus-visible rule (globals.css) — same fix as
                Input.tsx: `!` to actually win, plus the same rounded
                border+glow focus treatment Input.tsx uses instead of a bare
                outline, applied to the whole row via focus-within since the
                border/glow belongs on this rounded container, not the
                borderless <input> itself. */}
            <div
              className={cn(
                "flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5",
                "transition-shadow duration-150 focus-within:border-accent focus-within:shadow-(--shadow-input-focus)",
              )}
            >
              <Search className="h-4 w-4 shrink-0 text-fg/40" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products, SKUs, orders, customers…"
                className="w-full bg-transparent text-sm text-fg outline-none! placeholder:text-fg/40"
              />
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="shrink-0 rounded-md p-1 text-fg/40 transition-colors hover:bg-bg-2 hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5">
            {!trimmed ? (
              <div className="grid grid-cols-1 gap-2 p-1 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => { close(); navigate("/catalogue"); }}
                  className="flex items-center gap-2.5 rounded-xl border border-border px-3.5 py-3 text-left transition-colors hover:bg-bg-2/60"
                >
                  <Package className="h-4 w-4 shrink-0 text-accent" />
                  <span className="flex-1 text-sm font-semibold text-fg">Browse Products</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-fg/30" />
                </button>
                <button
                  type="button"
                  onClick={() => { close(); navigate("/orders"); }}
                  className="flex items-center gap-2.5 rounded-xl border border-border px-3.5 py-3 text-left transition-colors hover:bg-bg-2/60"
                >
                  <ShoppingCart className="h-4 w-4 shrink-0 text-accent" />
                  <span className="flex-1 text-sm font-semibold text-fg">View All Orders</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-fg/30" />
                </button>
              </div>
            ) : (
              <>
                {pageResults.length > 0 && (
                  <CommandPaletteSection
                    heading="Pages"
                    isLoading={false}
                    isError={false}
                    items={pageResults}
                    renderItem={(item) => (
                      <PaletteRow
                        key={item.href}
                        active={indexOf(`page:${item.href}`) === activeIndex}
                        onClick={() => { close(); navigate(item.href); }}
                        onMouseEnter={() => setActiveIndex(indexOf(`page:${item.href}`))}
                        icon={item.icon({ className: "h-4 w-4" })}
                        title={item.label}
                        subtitle="Page"
                      />
                    )}
                  />
                )}

                <CommandPaletteSection
                  heading="Products"
                  total={productsRes?.data.total}
                  isLoading={productsLoading}
                  isError={productsErrored}
                  items={products}
                  renderItem={(p) => (
                    <PaletteRow
                      key={p._id}
                      active={indexOf(`product:${p._id}`) === activeIndex}
                      onClick={() => { close(); navigate(`/products/${p.slug}/edit`); }}
                      onMouseEnter={() => setActiveIndex(indexOf(`product:${p._id}`))}
                      icon={<Package className="h-4 w-4" />}
                      title={p.title}
                      subtitle={`SKU: ${p.sku ?? "—"} • ${p.categories[0]?.name ?? "Uncategorised"}`}
                      trailing={formatCurrency(p.price)}
                      trailingSub={<span className={STOCK_TEXT_TONE[p.stock_status]}>{stockLabel(p)}</span>}
                    />
                  )}
                />

                <CommandPaletteSection
                  heading="Orders"
                  total={ordersRes?.data.total}
                  isLoading={ordersLoading}
                  isError={ordersErrored}
                  items={orders}
                  renderItem={(o) => (
                    <PaletteRow
                      key={o._id}
                      active={indexOf(`order:${o._id}`) === activeIndex}
                      onClick={() => { close(); navigate(`/orders/${o._id}`); }}
                      onMouseEnter={() => setActiveIndex(indexOf(`order:${o._id}`))}
                      icon={<ShoppingCart className="h-4 w-4" />}
                      title={formatOrderNumber(o.order_number_prefix, o.order_number)}
                      subtitle={o.customer.name}
                      trailing={formatCurrencyFromCents(o.total)}
                      trailingSub={<OrderStatusBadge status={o.fulfillment_status} />}
                    />
                  )}
                />

                <CommandPaletteSection
                  heading="Customers"
                  total={customersRes?.data.total}
                  isLoading={customersLoading}
                  isError={customersErrored}
                  items={customers}
                  renderItem={(c) => (
                    <PaletteRow
                      key={c._id}
                      active={indexOf(`customer:${c._id}`) === activeIndex}
                      onClick={() => { close(); navigate(`/customers/${c._id}`); }}
                      onMouseEnter={() => setActiveIndex(indexOf(`customer:${c._id}`))}
                      icon={<Users className="h-4 w-4" />}
                      title={c.company_name || c.name}
                      subtitle={c.email ?? "No email on file"}
                      trailing={`${c.orders_count} ${c.orders_count === 1 ? "order" : "orders"}`}
                    />
                  )}
                />

                {noResults && (
                  <p className="px-2.5 py-8 text-center text-sm text-fg/45">
                    No products, orders, pages or customers found for "{debouncedQuery}"
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end border-t border-border px-4 py-2.5 text-xs text-fg/40">
            Press
            <kbd className="mx-1.5 rounded-xs border border-border bg-bg-2 px-1.5 py-0.5 text-[10px] font-medium text-fg/50">
              ESC
            </kbd>
            to close
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Modal>
  );
}
