
import { useMemo, useState } from "react";
import Link from "@/components/ui/link";
import type { Order, OrderChannel, PaymentStatus } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect as Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { formatCurrency } from "@/utils/format";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/context";
import { InvoiceDrawer } from "@/components/orders/invoice-drawer";
import { useOrders } from "@/context";

function Status({ status }: { status: Order["status"] }) {
  switch (status) {
    case "paid":
      return <Badge variant="ok">Paid</Badge>;
    case "processing":
      return <Badge variant="warn">Processing</Badge>;
    case "shipped":
      return <Badge variant="ok">Shipped</Badge>;
    case "cancelled":
      return <Badge variant="danger">Cancelled</Badge>;
    case "refunded":
      return <Badge variant="muted">Refunded</Badge>;
  }
}

export function OrdersTable() {
  const [q, setQ] = useState("");
  const [payment, setPayment] = useState<"" | PaymentStatus>("");
  const [channel, setChannel] = useState<"" | OrderChannel>("");
  const [active, setActive] = useState<Order | null>(null);
  const [invoiceFor, setInvoiceFor] = useState<Order | null>(null);
  const { toast } = useToast();
  const { orders } = useOrders();

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (payment && o.paymentStatus !== payment) return false;
      if (channel && o.channel !== channel) return false;
      if (!query) return true;
      return (
        o.id.toLowerCase().includes(query) ||
        o.customer.name.toLowerCase().includes(query) ||
        o.customer.email.toLowerCase().includes(query)
      );
    });
  }, [q, orders, payment, channel]);

  const paymentBadge = (s: PaymentStatus) =>
    s === "paid" ? <Badge variant="ok">Paid</Badge> : <Badge variant="warn">Unpaid</Badge>;

  return (
    <>
      <Card>
        <CardHeader
          title="Orders"
          description="Search by order ID or customer."
          right={
            <Button
              variant="secondary"
              
              onClick={() => toast({ tone: "default", title: "Export queued", description: "Demo action." })}
            >
              Export
            </Button>
          }
        />
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-[420px]">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg/45">
                <Icons.Search />
              </span>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
                placeholder="Search orders…"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Select
                  value={payment}
                  onChange={(e) => setPayment(e.target.value as "" | PaymentStatus)}
                  aria-label="Filter by payment status"
                  
                >
                  <option value="">All payments</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </Select>
                <Select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as "" | OrderChannel)}
                  aria-label="Filter by channel"
                  
                >
                  <option value="">All channels</option>
                  <option value="counter">Counter</option>
                  <option value="web">Website</option>
                  <option value="ebay">eBay</option>
                </Select>
              </div>
            <Link href="/orders/new">
              <Button >Create order</Button>
            </Link>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-bg-2/60">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                    Order
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                    Channel
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                    Payment
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                    Total
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-bg">
                {rows.map((o) => (
                  <tr key={o.id} className="hover:bg-bg-2/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold">{o.id}</td>
                    <td className="px-4 py-3 text-sm text-fg/70">{o.date}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{o.customer.name}</div>
                      <div className="text-xs text-fg/60">{o.customer.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-fg/70">{o.channel}</td>
                    <td className="px-4 py-3">
                      <Status status={o.status} />
                    </td>
                    <td className="px-4 py-3">{paymentBadge(o.paymentStatus)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">
                      {formatCurrency(o.total)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button variant="secondary"  onClick={() => setInvoiceFor(o)}>
                          Invoice
                        </Button>
                        <Button variant="secondary"  onClick={() => setActive(o)}>
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-fg/60">
            Showing <span className="font-semibold text-fg">{rows.length}</span> orders
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!active} onClose={() => setActive(null)} title={active ? `Order ${active.id}` : "Order"}>
        {active ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-bg-2/30 p-4 sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-fg/60">Customer</div>
                <div className="mt-1 text-sm font-semibold">{active.customer.name}</div>
                <div className="text-xs text-fg/60">{active.customer.email}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-fg/60">Status</div>
                <div className="mt-2">
                  <Status status={active.status} />
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-fg/60">Channel</div>
                <div className="mt-1 text-sm">{active.channel}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-fg/60">Tracking</div>
                <div className="mt-1 text-sm">{active.tracking ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-fg/60">Payment</div>
                <div className="mt-2">{paymentBadge(active.paymentStatus)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-fg/60">Fulfilment</div>
                <div className="mt-1 text-sm">{active.fulfilment}</div>
              </div>
            </div>

            <div className="rounded-xl border border-border p-4">
              <div className="text-xs font-semibold text-fg/60">Summary</div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-sm text-fg/70">Order total</div>
                <div className="text-sm font-semibold">{formatCurrency(active.total)}</div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" className="flex-1">
                Refund
              </Button>
              <Button variant="secondary" className="flex-1">
                Mark shipped
              </Button>
              <Button className="flex-1">Contact customer</Button>
            </div>
          </div>
        ) : null}
      </Dialog>

      <InvoiceDrawer open={!!invoiceFor} onClose={() => setInvoiceFor(null)} order={invoiceFor} />
    </>
  );
}

