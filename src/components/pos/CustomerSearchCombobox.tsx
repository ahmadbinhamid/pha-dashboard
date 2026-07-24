import { useEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useQuery } from "@tanstack/react-query";
import { Search, UserPlus, Loader2, ChevronDown, Check } from "lucide-react";
import { cn } from "@/utils/cn";
import { getCustomers } from "@/lib/api/customers";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import type { Customer } from "@/types/customer";

interface CustomerSearchComboboxProps {
  value: Customer | null;
  onSelect: (customer: Customer) => void;
  onCreateNew: (searchText: string) => void;
  className?: string;
}

// Unlike the generic Combobox (which filters a fixed local list), this
// re-queries the customers API on every keystroke — so a customer who
// wouldn't appear on the listing page's first page (pagination) is still
// found as soon as their name/email/phone matches the search term. With no
// search text yet, it shows the same first page (default 15) the Customers
// list page would show, so staff can browse recent customers without typing.
export function CustomerSearchCombobox({ value, onSelect, onCreateNew, className }: CustomerSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ["customers-search", debouncedQuery],
    queryFn: () => getCustomers({ search: debouncedQuery, limit: DEFAULT_PAGE_SIZE }),
    enabled: open,
  });
  const results = data?.data?.items ?? [];

  function handleSelect(customer: Customer) {
    onSelect(customer);
    setOpen(false);
    setQuery("");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-xs border border-border bg-bg px-3 py-2 text-sm shadow-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
            value ? "text-fg" : "text-fg/45",
            className,
          )}
        >
          <span className="truncate">
            {value ? `${value.name}${value.email ? ` — ${value.email}` : ""}` : "Search for a customer…"}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          className={cn(
            "z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xs border border-border bg-bg shadow-lg",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-fg/40" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, phone…"
              className="flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg/40"
            />
            {isFetching && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-fg/40" />}
          </div>

          <div className="max-h-60 overflow-y-auto p-1">
            {!debouncedQuery && results.length > 0 && (
              <div className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg/40">
                Recent customers
              </div>
            )}
            {results.length === 0 && !isFetching ? (
              <div className="px-2 py-3 text-center">
                {debouncedQuery ? (
                  <p className="mb-2 text-xs text-fg/50">No customers found for &quot;{debouncedQuery}&quot;</p>
                ) : (
                  <p className="mb-2 text-xs text-fg/50">No customers yet</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onCreateNew(debouncedQuery);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xs px-2 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Create new customer
                </button>
              </div>
            ) : (
              results.map((customer) => (
                <button
                  key={customer._id}
                  type="button"
                  onClick={() => handleSelect(customer)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xs px-2 py-1.5 text-left text-sm transition-colors",
                    "hover:bg-accent/10 hover:text-fg",
                    customer._id === value?._id ? "bg-accent/10 font-medium text-fg" : "text-fg/80",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{customer.name}</div>
                    <div className="truncate text-xs text-fg/45">
                      {customer.email || customer.phone || "No contact info"}
                    </div>
                  </div>
                  {customer._id === value?._id && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
