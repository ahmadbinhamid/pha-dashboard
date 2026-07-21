import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { OrderChannelBadge } from "@/components/orders/OrderChannelBadge";
import { OrderRowActionsMenu } from "@/components/orders/OrderRowActionsMenu";
import { getOrders } from "@/lib/api/orders";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { formatCurrencyFromCents } from "@/utils/format";
import type { Order, OrderStatus, OrderChannel } from "@/types/orders";
import { Search, ShoppingCart } from "lucide-react";

const STATUS_FILTERS: { label: string; value: OrderStatus | "" }[] = [
  { label: "All Status", value: "" },
  { label: "Pending Payment", value: "pending_payment" },
  { label: "Paid", value: "paid" },
  { label: "Fulfilled", value: "fulfilled" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Refunded", value: "refunded" },
  { label: "Partially Refunded", value: "partially_refunded" },
];

const CHANNEL_FILTERS: { label: string; value: OrderChannel | "" }[] = [
  { label: "All Channels", value: "" },
  { label: "Storefront", value: "storefront" },
  { label: "eBay", value: "ebay" },
];

const TABLE_HEADERS = [
  { label: "Order", align: "left" },
  { label: "Customer", align: "left" },
  { label: "Channel", align: "left" },
  { label: "Items", align: "right" },
  { label: "Total", align: "right" },
  { label: "Status", align: "left" },
  { label: "Date", align: "right" },
  { label: "Actions", align: "right" },
];

export default function OrdersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";
  const channel = searchParams.get("channel") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10);

  const [inputValue, setInputValue] = useState(search);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchParams((prev) => {
        const current = prev.get("search") ?? "";
        if (inputValue === current) return prev;
        const next = new URLSearchParams(prev);
        if (inputValue) next.set("search", inputValue);
        else next.delete("search");
        next.set("page", "1");
        return next;
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [inputValue, setSearchParams]);

  const setStatus = useCallback(
    (val: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (val) next.set("status", val);
        else next.delete("status");
        next.set("page", "1");
        return next;
      });
    },
    [setSearchParams],
  );

  const setChannel = useCallback(
    (val: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (val) next.set("channel", val);
        else next.delete("channel");
        next.set("page", "1");
        return next;
      });
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (p: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("page", String(p));
        return next;
      });
    },
    [setSearchParams],
  );

  const setLimit = useCallback(
    (l: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("limit", String(l));
        next.set("page", "1");
        return next;
      });
    },
    [setSearchParams],
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["orders", { search, status, channel, page, limit }],
    queryFn: () => getOrders({ search, status, channel, page, limit }),
  });

  const orders: Order[] = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description={total > 0 ? `${total} order${total !== 1 ? "s" : ""}` : "Orders from your storefront and eBay"}
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none text-fg/40" />
            <Input
              placeholder="Search order #, name, email…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-3">
            {isFetching && !isLoading && <span className="text-xs text-fg/40">Updating…</span>}
            <FilterSelect options={CHANNEL_FILTERS} value={channel} onChange={setChannel} />
            <FilterSelect options={STATUS_FILTERS} value={status} onChange={setStatus} />
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingSkeleton />
          ) : orders.length === 0 ? (
            <EmptyState search={search} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-2/40">
                  {TABLE_HEADERS.map((h, i) => (
                    <th
                      key={i}
                      className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-fg/45 ${
                        h.align === "right" ? "text-right" : "text-left"
                      } first:px-5`}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => {
                  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
                  return (
                    <tr
                      key={order._id}
                      className="cursor-pointer transition hover:bg-bg-2/40"
                      onClick={() => navigate(`/orders/${order._id}`)}
                    >
                      <td className="px-5 py-3.5 font-medium text-fg">{order.order_number}</td>
                      <td className="px-4 py-3.5">
                        <div className="text-fg">{order.customer.name}</div>
                        <div className="text-xs text-fg/50">{order.customer.email}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <OrderChannelBadge channel={order.channel} />
                      </td>
                      <td className="px-4 py-3.5 text-right text-fg/60">{itemCount}</td>
                      <td className="px-4 py-3.5 text-right text-fg">{formatCurrencyFromCents(order.total)}</td>
                      <td className="px-4 py-3.5">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right text-fg/60">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <OrderRowActionsMenu onView={() => navigate(`/orders/${order._id}`)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          itemsPerPage={limit}
          onLimitChange={setLimit}
          isLoading={isFetching}
          onPageChange={setPage}
        />
      </Card>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-border">
      {[180, 220, 100, 140, 120, 150].map((w, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <div className="h-3.5 animate-pulse rounded-xs bg-bg-2" style={{ width: w }} />
          <div className="ml-auto h-5 w-16 animate-pulse rounded-xs bg-bg-2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-xs border border-border bg-bg-2">
        <ShoppingCart className="h-8 w-8 text-fg/30" />
      </div>
      <div>
        <p className="font-medium text-fg">{search ? "No orders found" : "No orders yet"}</p>
        <p className="mt-1 text-sm text-fg/50">
          {search ? `No results for "${search}" — try a different term` : "Orders will appear here once customers check out."}
        </p>
      </div>
    </div>
  );
}
