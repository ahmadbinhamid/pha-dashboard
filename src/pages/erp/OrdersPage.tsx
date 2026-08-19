import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { ManageColumns } from "@/components/ui/ManageColumns";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/Table";
import { StickyTableHead, StickyTableCell } from "@/components/ui/StickyTableColumn";
import { PageHeader } from "@/components/shared/PageHeader";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { OrderPaymentStatusBadge } from "@/components/orders/OrderPaymentStatusBadge";
import { OrderChannelBadge } from "@/components/orders/OrderChannelBadge";
import { OrderRowActionsMenu } from "@/components/orders/OrderRowActionsMenu";
import { getOrders } from "@/lib/api/orders";
import { useColumnVisibility, type ColumnDef } from "@/hooks/useColumnVisibility";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { formatCurrencyFromCents, formatInvoiceNumber } from "@/utils/format";
import type { Order, OrderFulfillmentStatus, OrderPaymentStatus, OrderChannel, OrderDeliveryMethod } from "@/types/orders";
import { Search, ShoppingCart } from "lucide-react";

// Order lifecycle — independent of payment status (see PAYMENT_STATUS_FILTERS
// below and OrderStatusSelect for the same 5-state split on the detail page).
const STATUS_FILTERS: { label: string; value: OrderFulfillmentStatus | "" }[] = [
  { label: "All Status", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Processing", value: "processing" },
  { label: "On Hold", value: "on_hold" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

// Always derived from actual payments/refunds — never admin-editable.
const PAYMENT_STATUS_FILTERS: { label: string; value: OrderPaymentStatus | "" }[] = [
  { label: "All Payment", value: "" },
  { label: "Unpaid", value: "pending_payment" },
  { label: "Partially Paid", value: "partially_paid" },
  { label: "Paid", value: "paid" },
  { label: "Partially Refunded", value: "partially_refunded" },
  { label: "Refunded", value: "refunded" },
];

const CHANNEL_FILTERS: { label: string; value: OrderChannel | "" }[] = [
  { label: "All Channels", value: "" },
  { label: "Storefront", value: "storefront" },
  { label: "eBay", value: "ebay" },
];

const MODE_FILTERS: { label: string; value: OrderDeliveryMethod | "" }[] = [
  { label: "All Modes", value: "" },
  { label: "Delivery", value: "delivery" },
  { label: "Pickup", value: "pickup" },
];

// Order ID (sticky) and Actions are structural, not part of this list — every
// other column can be hidden via "Manage Columns", persisted per browser.
const ORDER_COLUMNS: ColumnDef[] = [
  { key: "customer", label: "Customer", alwaysVisible: true },
  { key: "channel", label: "Channel" },
  { key: "items", label: "Items" },
  { key: "order_id", label: "Order Id" },
  { key: "total", label: "Total" },
  { key: "status", label: "Status" },
  { key: "payment", label: "Payment" },
  { key: "date", label: "Date" },
];

export default function OrdersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { visibility, toggleColumn, isVisible } = useColumnVisibility("orders", ORDER_COLUMNS);

  const search = searchParams.get("search") ?? "";
  const fulfillmentStatus = searchParams.get("fulfillment_status") ?? "";
  const paymentStatus = searchParams.get("payment_status") ?? "";
  const channel = searchParams.get("channel") ?? "";
  const deliveryMethod = searchParams.get("delivery_method") ?? "";
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
      }, { replace: true });
    }, 400);
    return () => clearTimeout(timer);
  }, [inputValue, setSearchParams]);

  const setFulfillmentStatus = useCallback(
    (val: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (val) next.set("fulfillment_status", val);
        else next.delete("fulfillment_status");
        next.set("page", "1");
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const setPaymentStatus = useCallback(
    (val: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (val) next.set("payment_status", val);
        else next.delete("payment_status");
        next.set("page", "1");
        return next;
      }, { replace: true });
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
      }, { replace: true });
    },
    [setSearchParams],
  );

  const setDeliveryMethod = useCallback(
    (val: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (val) next.set("delivery_method", val);
        else next.delete("delivery_method");
        next.set("page", "1");
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (p: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("page", String(p));
        return next;
      }, { replace: true });
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
      }, { replace: true });
    },
    [setSearchParams],
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["orders", { search, fulfillmentStatus, paymentStatus, channel, deliveryMethod, page, limit }],
    queryFn: () =>
      getOrders({
        search,
        fulfillment_status: fulfillmentStatus,
        payment_status: paymentStatus,
        channel,
        delivery_method: deliveryMethod,
        page,
        limit,
      }),
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

      <Card className="overflow-hidden">
        {/* Filter bar — search, selects, and Manage Columns all in one row above the table */}
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
              <Input
                placeholder="Search order #, name, email…"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="pl-9"
                size="sm"
              />
            </div>
            <FilterSelect options={CHANNEL_FILTERS} value={channel} onChange={setChannel} className="h-9" />
            <FilterSelect options={STATUS_FILTERS} value={fulfillmentStatus} onChange={setFulfillmentStatus} className="h-9" />
            <FilterSelect options={PAYMENT_STATUS_FILTERS} value={paymentStatus} onChange={setPaymentStatus} className="h-9" />
            <FilterSelect options={MODE_FILTERS} value={deliveryMethod} onChange={setDeliveryMethod} className="h-9" />
            {isFetching && !isLoading && <span className="text-xs text-fg/40">Updating…</span>}
          </div>

          <ManageColumns columns={ORDER_COLUMNS} visibility={visibility} onToggle={toggleColumn} />
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : orders.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-200">
              <TableHeader>
                <TableRow>
                  <StickyTableHead size={36}>
                    Invoice #
                  </StickyTableHead>
                  {isVisible("customer") && <TableHead className="min-w-44">Customer</TableHead>}
                  {isVisible("channel") && <TableHead>Channel</TableHead>}
                  {isVisible("items") && <TableHead className="text-right">Items</TableHead>}
                  {isVisible("order_id") && <TableHead>Order Id</TableHead>}
                  {isVisible("total") && <TableHead className="text-right">Total</TableHead>}
                  {isVisible("status") && <TableHead>Status</TableHead>}
                  {isVisible("payment") && <TableHead>Payment</TableHead>}
                  {isVisible("date") && <TableHead className="text-right">Date</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
                  return (
                    <TableRow
                      key={order._id}
                      className="group cursor-pointer"
                      onClick={() => navigate(`/orders/${order._id}`)}
                    >
                      <StickyTableCell size={36} className="truncate font-medium text-fg">
                        {formatInvoiceNumber(order.invoice_number_prefix, order.invoice_number)}
                      </StickyTableCell>
                      {isVisible("customer") && (
                        <TableCell className="max-w-52">
                          <div className="truncate text-fg">{order.customer.name}</div>
                          <div className="truncate text-xs text-fg/50">{order.customer.email}</div>
                        </TableCell>
                      )}
                      {isVisible("channel") && (
                        <TableCell>
                          <OrderChannelBadge channel={order.channel} />
                        </TableCell>
                      )}
                      {isVisible("items") && <TableCell className="text-right text-fg/60">{itemCount}</TableCell>}
                      {isVisible("order_id") && (
                        <TableCell className="text-fg/60">{order.reference_number || "—"}</TableCell>
                      )}
                      {isVisible("total") && (
                        <TableCell className="text-right text-fg">{formatCurrencyFromCents(order.total)}</TableCell>
                      )}
                      {isVisible("status") && (
                        <TableCell>
                          <OrderStatusBadge status={order.fulfillment_status} />
                        </TableCell>
                      )}
                      {isVisible("payment") && (
                        <TableCell>
                          <OrderPaymentStatusBadge status={order.payment_status} />
                        </TableCell>
                      )}
                      {isVisible("date") && (
                        <TableCell className="text-right text-fg/60">
                          {new Date(order.created_at).toLocaleDateString()}
                        </TableCell>
                      )}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <OrderRowActionsMenu onView={() => navigate(`/orders/${order._id}`)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

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
