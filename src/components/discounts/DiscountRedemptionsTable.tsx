import { Link } from "react-router-dom";
import { ReceiptText } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import type { DiscountRedemption } from "@/types/discount";
import { formatCurrencyFromCents, formatOrderNumber, formatRelativeTime } from "@/utils/format";

export function DiscountRedemptionsTable({ redemptions }: { redemptions: DiscountRedemption[] }) {
  return (
    <Card>
      <CardHeader title="Recent orders" description="The latest orders that used this discount." />
      {redemptions.length ? (
        <div className="overflow-x-auto">
          <Table className="min-w-160">
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Order total</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {redemptions.map((r) => (
                <TableRow key={r._id}>
                  <TableCell className="font-medium">
                    {r.order ? (
                      <Link to={`/orders/${r.order._id}`} className="text-fg hover:text-accent">
                        {formatOrderNumber(r.order.order_number_prefix, r.order.order_number)}
                      </Link>
                    ) : (
                      <span className="text-fg/45">Pending</span>
                    )}
                  </TableCell>
                  <TableCell className="text-fg/60">{r.customer_email}</TableCell>
                  <TableCell className="text-right tabular-nums text-fg/60">{formatCurrencyFromCents(r.order_total)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium text-ok">
                    −{formatCurrencyFromCents(r.discount_amount)}
                  </TableCell>
                  <TableCell className="text-right text-fg/55">{formatRelativeTime(r.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState icon={ReceiptText} title="Not used yet" description="Orders that use this discount appear here." className="py-10" />
      )}
    </Card>
  );
}
