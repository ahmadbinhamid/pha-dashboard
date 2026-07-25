import { Card, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/Table";
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
            <Table className="min-w-100">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-2 h-8 min-w-28 px-2 sticky-col-header sticky-col-separator-right">
                    Order
                  </TableHead>
                  <TableHead className="h-8 px-2">Customer</TableHead>
                  <TableHead className="h-8 px-2 text-right">Amount</TableHead>
                  <TableHead className="h-8 px-2">Status</TableHead>
                  <TableHead className="h-8 px-2 text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const order = typeof payment.order === "object" ? payment.order : null;
                  return (
                    <TableRow key={payment._id} className="group">
                      <TableCell className="sticky left-0 z-1 max-w-28 truncate px-2 py-2.5 font-medium text-fg sticky-col-cell sticky-col-separator-right">
                        {order?.order_number ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-36 truncate px-2 py-2.5 text-fg/70">
                        {order?.customer.name ?? "—"}
                      </TableCell>
                      <TableCell className="px-2 py-2.5 text-right text-fg">
                        {formatCurrencyFromCents(payment.amount)}
                      </TableCell>
                      <TableCell className="px-2 py-2.5">
                        <PaymentStatusBadge status={payment.status} />
                      </TableCell>
                      <TableCell className="px-2 py-2.5 text-right text-fg/55">
                        {new Date(payment.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
