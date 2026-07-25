import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/Table";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";
import { PaymentDetailDrawer } from "@/components/payments/PaymentDetailDrawer";
import { PaymentRowActionsMenu } from "@/components/payments/PaymentRowActionsMenu";
import { getPayments } from "@/lib/api/payments";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { formatCurrencyFromCents } from "@/utils/format";
import type { Payment, PaymentStatus } from "@/types/payment";
import { CreditCard } from "lucide-react";

const STATUS_FILTERS: { label: string; value: PaymentStatus | "" }[] = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Succeeded", value: "succeeded" },
  { label: "Failed", value: "failed" },
  { label: "Canceled", value: "canceled" },
];

export default function PaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10);

  const [selected, setSelected] = useState<Payment | null>(null);

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
    queryKey: ["payments", { status, page, limit }],
    queryFn: () => getPayments({ status, page, limit }),
  });

  const payments: Payment[] = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description={total > 0 ? `${total} payment${total !== 1 ? "s" : ""}` : "Stripe payments and refunds"}
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <FilterSelect options={STATUS_FILTERS} value={status} onChange={setStatus} />
          {isFetching && !isLoading && <span className="text-xs text-fg/40">Updating…</span>}
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : payments.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-180">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-2 min-w-36 sticky-col-header sticky-col-separator-right">
                    Order
                  </TableHead>
                  <TableHead className="min-w-44">Customer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Refunded</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const order = typeof payment.order === "object" ? payment.order : null;
                  return (
                    <TableRow
                      key={payment._id}
                      className="group cursor-pointer"
                      onClick={() => setSelected(payment)}
                    >
                      <TableCell className="sticky left-0 z-1 max-w-36 truncate font-medium text-fg sticky-col-cell sticky-col-separator-right">
                        {order?.order_number ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-52">
                        <div className="truncate text-fg">{order?.customer.name ?? "—"}</div>
                        <div className="truncate text-xs text-fg/50">{order?.customer.email ?? ""}</div>
                      </TableCell>
                      <TableCell className="text-right text-fg">{formatCurrencyFromCents(payment.amount)}</TableCell>
                      <TableCell className="text-right text-fg/60">
                        {payment.amount_refunded > 0 ? formatCurrencyFromCents(payment.amount_refunded) : "—"}
                      </TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={payment.status} />
                      </TableCell>
                      <TableCell className="text-right text-fg/60">
                        {new Date(payment.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <PaymentRowActionsMenu onView={() => setSelected(payment)} />
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

      {selected && <PaymentDetailDrawer paymentId={selected._id} onClose={() => setSelected(null)} />}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-border">
      {[180, 220, 140, 160, 120, 150].map((w, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <div className="h-3.5 animate-pulse rounded-xs bg-bg-2" style={{ width: w }} />
          <div className="ml-auto h-5 w-16 animate-pulse rounded-xs bg-bg-2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-xs border border-border bg-bg-2">
        <CreditCard className="h-8 w-8 text-fg/30" />
      </div>
      <div>
        <p className="font-medium text-fg">No payments yet</p>
        <p className="mt-1 text-sm text-fg/50">Payments will appear here once customers check out.</p>
      </div>
    </div>
  );
}
