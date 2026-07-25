import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer, Mail, Pencil, PackageX } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { BreadcrumbNav } from "@/components/ui/BreadcrumbNav";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { OrderChannelBadge } from "@/components/orders/OrderChannelBadge";
import { OrderDeliveryMethodBadge } from "@/components/orders/OrderDeliveryMethodBadge";
import { OrderItemsTable } from "@/components/orders/OrderItemsTable";
import { OrderPaymentSummaryCard } from "@/components/orders/OrderPaymentSummaryCard";
import { OrderNotesSection } from "@/components/orders/OrderNotesSection";
import { SendOrderEmailModal } from "@/components/orders/SendOrderEmailModal";
import { EditOrderDetailsModal } from "@/components/orders/EditOrderDetailsModal";
import { InvoicePrintView } from "@/components/orders/InvoicePrintView";
import { getOrderDetail } from "@/lib/api/orders";
import { formatCurrencyFromCents } from "@/utils/format";
import type { OrderAddress } from "@/types/orders";

function AddressBlock({ address }: { address: OrderAddress }) {
  return (
    <div className="text-sm text-fg/70">
      <div>{address.address}</div>
      <div>
        {address.suburb} {address.state} {address.postcode}
      </div>
    </div>
  );
}

function OrderDetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
      <Skeleton className="h-3 w-32" />
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="rounded-xs border border-border bg-card p-5 space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="rounded-xs border border-border bg-card p-5 space-y-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
        <div className="rounded-xs border border-border bg-card p-5 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="mx-auto max-w-5xl py-20 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xs border border-border bg-bg-2">
        <PackageX className="h-8 w-8 text-fg/30" />
      </div>
      <p className="font-medium text-fg">Order not found</p>
      <p className="mt-1 text-sm text-fg/50">This order may have been removed, or the link is incorrect.</p>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [editDetailsModalOpen, setEditDetailsModalOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrderDetail(id!),
    enabled: !!id,
  });

  const order = data?.data;

  if (isLoading) return <OrderDetailSkeleton />;
  if (isError || !order) return <NotFoundState />;

  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const totalDiscount = order.items.reduce((sum, i) => sum + i.discount_amount, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
      {/* On-screen admin view — the actual invoice (matching what's emailed
          to the customer) is rendered separately below, for print only. */}
      <div className="space-y-5 print:hidden">
        <BreadcrumbNav items={[{ label: "Orders", href: "/orders" }, { label: order.order_number }]} />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight">{order.order_number}</h1>
              <OrderStatusBadge status={order.status} />
              <OrderDeliveryMethodBadge method={order.delivery_method} />
              <OrderChannelBadge channel={order.channel} />
            </div>
            <p className="mt-1 text-sm text-fg/55">
              Placed {new Date(order.created_at).toLocaleString()}
              {order.updated_at !== order.created_at && (
                <span className="text-fg/40"> · Last updated {new Date(order.updated_at).toLocaleString()}</span>
              )}
            </p>
          </div>
          <div className="flex gap-2 self-start">
            <Button variant="secondary" size="md" className="gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print Invoice
            </Button>
            <Button variant="primary" size="md" className="gap-2" onClick={() => setEmailModalOpen(true)}>
              <Mail className="h-4 w-4" />
              Send Email
            </Button>
          </div>
        </div>

        {order.has_stock_issue && (
          <div className="rounded-lg border border-[hsl(var(--warn))]/30 bg-[hsl(var(--warn))]/10 px-4 py-3 text-sm text-[hsl(var(--warn))]">
            Stock issue — {order.stock_issue_note ?? "insufficient stock was available at the time this order was paid."}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card>
              <CardHeader title="Items" description={`${itemCount} item${itemCount !== 1 ? "s" : ""}`} />
              <OrderItemsTable items={order.items} />
              <div className="space-y-1.5 border-t border-border px-5 py-4 text-sm">
                <div className="flex justify-between text-fg/60">
                  <span>Subtotal</span>
                  <span>{formatCurrencyFromCents(order.subtotal + totalDiscount)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-fg/60">
                    <span>Discount</span>
                    <span>-{formatCurrencyFromCents(totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-fg/60">
                  <span>Shipping</span>
                  <span>{formatCurrencyFromCents(order.shipping_cost)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold text-fg">
                  <span>Total</span>
                  <span>{formatCurrencyFromCents(order.total)}</span>
                </div>
              </div>
            </Card>

            {order.note && (
              <Card>
                <CardHeader title="Customer Note" />
                <CardContent>
                  <p className="text-sm text-fg/70">{order.note}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader
                title="Customer & Addresses"
                right={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setEditDetailsModalOpen(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                }
              />
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg/45">Customer</div>
                  <div className="text-sm text-fg">{order.customer.name}</div>
                  <div className="text-xs text-fg/55">{order.customer.email}</div>
                  <div className="text-xs text-fg/55">{order.customer.phone}</div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg/45">
                    {order.delivery_method === "pickup" ? "Collection" : "Shipping Address"}
                  </div>
                  {order.shipping_address ? (
                    <AddressBlock address={order.shipping_address} />
                  ) : (
                    <div className="text-sm text-fg/70">Customer will collect this order in-store.</div>
                  )}
                </div>
                {order.tracking_number && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg/45">Tracking</div>
                    <div className="text-sm text-fg">{order.carrier_name}</div>
                    <div className="text-xs text-fg/55">{order.tracking_number}</div>
                  </div>
                )}
                {order.billing_address && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg/45">
                      Billing Address
                    </div>
                    <AddressBlock address={order.billing_address} />
                  </div>
                )}
              </CardContent>
            </Card>

            {order.channel === "ebay" && (
              <Card>
                <CardHeader title="eBay Details" />
                <CardContent className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-fg/60">External Order ID</span>
                    <span className="text-fg">{order.external_order_id ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-fg/60">Buyer Username</span>
                    <span className="text-fg">{order.external_buyer_username ?? "—"}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div>
            <Card>
              <CardHeader title="Payment" />
              <CardContent>
                <OrderPaymentSummaryCard
                  orderId={order._id}
                  orderStatus={order.status}
                  payments={order.payments}
                  refunds={order.refunds}
                  total={order.total}
                  channel={order.channel}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <OrderNotesSection orderId={order._id} notes={order.internal_notes} />
      </div>

      <div className="hidden print:block">
        <InvoicePrintView order={order} />
      </div>

      <SendOrderEmailModal order={order} open={emailModalOpen} onOpenChange={setEmailModalOpen} />
      <EditOrderDetailsModal order={order} open={editDetailsModalOpen} onOpenChange={setEditDetailsModalOpen} />
    </div>
  );
}
