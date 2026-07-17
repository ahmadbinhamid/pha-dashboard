import { Card, CardContent } from "@/components/ui/Card";
import { DashboardSectionLabel } from "@/components/dashboard/DashboardSectionLabel";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";
import Link from "@/components/ui/Link";
import { formatCurrencyFromCents } from "@/utils/format";
import type { Payment } from "@/types/payment";

export function RecentPaymentsCard({
  payments,
  loading,
}: {
  payments: Payment[];
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <DashboardSectionLabel>Recent Payments</DashboardSectionLabel>
          <Link href="/payments" className="text-xs font-medium text-accent hover:underline">
            View all
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded-xs bg-bg-2" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="py-6 text-center text-sm text-fg/45">No payments yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg/45">
                    Order
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg/45">
                    Customer
                  </th>
                  <th className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-fg/45">
                    Amount
                  </th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-fg/45">
                    Status
                  </th>
                  <th className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-fg/45">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((payment) => {
                  const order = typeof payment.order === "object" ? payment.order : null;
                  return (
                    <tr key={payment._id}>
                      <td className="px-2 py-2.5 font-medium text-fg">{order?.order_number ?? "—"}</td>
                      <td className="px-2 py-2.5 text-fg/70">{order?.customer.name ?? "—"}</td>
                      <td className="px-2 py-2.5 text-right text-fg">
                        {formatCurrencyFromCents(payment.amount)}
                      </td>
                      <td className="px-2 py-2.5">
                        <PaymentStatusBadge status={payment.status} />
                      </td>
                      <td className="px-2 py-2.5 text-right text-fg/55">
                        {new Date(payment.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
