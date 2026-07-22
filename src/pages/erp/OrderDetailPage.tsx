import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Printer, Mail, PackageX } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { BreadcrumbNav } from "@/components/ui/BreadcrumbNav";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { OrderChannelBadge } from "@/components/orders/OrderChannelBadge";
import { OrderDeliveryMethodBadge } from "@/components/orders/OrderDeliveryMethodBadge";
import { OrderItemsTable } from "@/components/orders/OrderItemsTable";
import { OrderPaymentSummaryCard } from "@/components/orders/OrderPaymentSummaryCard";
import { SendOrderEmailModal } from "@/components/orders/SendOrderEmailModal";
import { PartsHubLogoImage } from "@/components/branding/PartsHubLogoImage";
import { getOrderDetail } from "@/lib/api/orders";
import { formatCurrencyFromCents } from "@/utils/format";
import { COMPANY_INFO } from "@/config/company";
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

  const { data, isLoading, isError } = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrderDetail(id!),
    enabled: !!id,
  });

  const order = data?.data;

  if (isLoading) return <OrderDetailSkeleton />;
  if (isError || !order) return <NotFoundState />;

  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
      <div className="print:hidden">
        <BreadcrumbNav items={[{ label: "Orders", href: "/orders" }, { label: order.order_number }]} />
      </div>

      {/* Print-only letterhead — the on-screen header below already shows the
          order number/status, so this only needs to add what print is missing. */}
      <div className="hidden items-center gap-3 print:flex">
        <PartsHubLogoImage sizeClass="h-10" maxWidthClass="max-w-[40px]" priority />
        <div>
          <h2 className="font-display text-lg font-bold">{COMPANY_INFO.name}</h2>
          <p className="text-xs text-fg/60">ABN {COMPANY_INFO.abn}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight">{order.order_number}</h1>
            <OrderStatusBadge status={order.status} />
            <OrderDeliveryMethodBadge method={order.delivery_method} />
            <span className="print:hidden">
              <OrderChannelBadge channel={order.channel} />
            </span>
          </div>
          <p className="mt-1 text-sm text-fg/55">Placed {new Date(order.created_at).toLocaleString()}</p>
        </div>
        <div className="flex gap-2 self-start print:hidden">
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
        <div className="rounded-lg border border-[hsl(var(--warn))]/30 bg-[hsl(var(--warn))]/10 px-4 py-3 text-sm text-[hsl(var(--warn))] print:hidden">
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
                <span>{formatCurrencyFromCents(order.subtotal)}</span>
              </div>
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

          <Card>
            <CardHeader title="Customer & Addresses" />
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
            <Card className="print:hidden">
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

        <div className="print:hidden">
          <Card>
            <CardHeader title="Payment" />
            <CardContent>
              <OrderPaymentSummaryCard payment={order.payment} refunds={order.refunds} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Print-only condensed payment info — the full OrderPaymentSummaryCard
          above is print:hidden since its refund history/"View in Payments"
          link are admin-only and don't belong on a customer-facing invoice. */}
      {order.payment && (
        <div className="hidden text-sm print:block">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-fg/45">Payment Information</div>
          <div className="text-fg">
            {order.payment.card_brand
              ? `${order.payment.card_brand.charAt(0).toUpperCase()}${order.payment.card_brand.slice(1)} Ending in ${order.payment.card_last4}`
              : "Card"}
          </div>
          <div className="text-xs text-fg/55">Processed via Secure Gateway</div>
        </div>
      )}

      <SendOrderEmailModal order={order} open={emailModalOpen} onOpenChange={setEmailModalOpen} />
    </div>
  );
}
