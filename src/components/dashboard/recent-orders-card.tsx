import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ORDERS } from "@/lib/data/orders";
import { formatCurrency } from "@/lib/format";

function statusBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge variant="ok">Paid</Badge>;
    case "processing":
      return <Badge variant="warn">Processing</Badge>;
    case "shipped":
      return <Badge variant="ok">Shipped</Badge>;
    case "refunded":
      return <Badge variant="muted">Refunded</Badge>;
    case "cancelled":
      return <Badge variant="danger">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function RecentOrdersCard() {
  return (
    <Card>
      <CardHeader
        title="Recent orders"
        description="Latest activity across channels."
        right={
          <Link href="/orders" className="text-xs font-semibold text-accent hover:underline">
            View all
          </Link>
        }
      />
      <CardContent className="px-0 py-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-bg-2/60">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                  Order
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                  Customer
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                  Channel
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                  Status
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ORDERS.map((o) => (
                <tr key={o.id} className="hover:bg-bg-2/30 transition-colors">
                  <td className="px-5 py-3 text-sm font-semibold">{o.id}</td>
                  <td className="px-5 py-3">
                    <div className="text-sm font-medium">{o.customer.name}</div>
                    <div className="text-xs text-fg/60">{o.customer.email}</div>
                  </td>
                  <td className="px-5 py-3 text-sm text-fg/70">{o.channel}</td>
                  <td className="px-5 py-3">{statusBadge(o.status)}</td>
                  <td className="px-5 py-3 text-right text-sm font-semibold">
                    {formatCurrency(o.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

