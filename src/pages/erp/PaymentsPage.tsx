import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";
import { PaymentDetailDrawer } from "@/components/payments/PaymentDetailDrawer";
import { getPayments } from "@/lib/api/payments";
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

const TABLE_HEADERS = [
  { label: "Order", align: "left" },
  { label: "Customer", align: "left" },
  { label: "Amount", align: "right" },
  { label: "Refunded", align: "right" },
  { label: "Status", align: "left" },
  { label: "Date", align: "right" },
];

export default function PaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1", 10);

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

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["payments", { status, page }],
    queryFn: () => getPayments({ status, page }),
  });

  const payments: Payment[] = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Payments</h1>
          <p className="mt-1 text-sm text-fg/55">
            {total > 0 ? `${total} payment${total !== 1 ? "s" : ""}` : "Stripe payments and refunds"}
          </p>
        </div>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-xs bg-bg-2 p-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatus(f.value)}
                className={`rounded-xs px-3 py-1.5 text-xs font-medium transition ${
                  status === f.value
                    ? "bg-bg text-fg shadow-sm ring-1 ring-inset ring-border"
                    : "text-fg/55 hover:text-fg"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {isFetching && !isLoading && <span className="text-xs text-fg/40">Updating…</span>}
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingSkeleton />
          ) : payments.length === 0 ? (
            <EmptyState />
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
                {payments.map((payment) => {
                  const order = typeof payment.order === "object" ? payment.order : null;
                  return (
                    <tr
                      key={payment._id}
                      className="cursor-pointer transition hover:bg-bg-2/40"
                      onClick={() => setSelected(payment)}
                    >
                      <td className="px-5 py-3.5 font-medium text-fg">{order?.order_number ?? "—"}</td>
                      <td className="px-4 py-3.5">
                        <div className="text-fg">{order?.customer.name ?? "—"}</div>
                        <div className="text-xs text-fg/50">{order?.customer.email ?? ""}</div>
                      </td>
                      <td className="px-4 py-3.5 text-right text-fg">{formatCurrencyFromCents(payment.amount)}</td>
                      <td className="px-4 py-3.5 text-right text-fg/60">
                        {payment.amount_refunded > 0 ? formatCurrencyFromCents(payment.amount_refunded) : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <PaymentStatusBadge status={payment.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right text-fg/60">
                        {new Date(payment.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <Pagination currentPage={page} totalPages={totalPages} totalItems={total} isLoading={isFetching} onPageChange={setPage} />
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
