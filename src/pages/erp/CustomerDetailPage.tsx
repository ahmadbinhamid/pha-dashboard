import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Trash2, Mail, Phone } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/Table";
import { StickyTableHead, StickyTableCell } from "@/components/ui/StickyTableColumn";
import { Button } from "@/components/ui/Button";
import { Can } from "@/components/auth/Can";
import { PERMISSIONS } from "@/config/permissions";
import { BreadcrumbNav } from "@/components/ui/BreadcrumbNav";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { OrderChannelBadge } from "@/components/orders/OrderChannelBadge";
import { CustomerAccountBadge } from "@/components/customers/CustomerAccountBadge";
import { CustomerFormModal } from "@/components/customers/CustomerFormModal";
import { BusinessRepresentativesCard } from "@/components/customers/BusinessRepresentativesCard";
import { CustomerDeleteModal } from "@/components/customers/CustomerDeleteModal";
import { CustomerDetailSkeleton } from "@/components/customers/CustomerDetailSkeleton";
import { CustomerNotFoundState } from "@/components/customers/CustomerNotFoundState";
import { getCustomer } from "@/lib/api/customers";
import { formatCurrencyFromCents, formatInvoiceNumber } from "@/utils/format";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => getCustomer(id!),
    enabled: !!id,
  });

  const customer = data?.data;

  if (isLoading) return <CustomerDetailSkeleton />;
  if (isError || !customer) return <CustomerNotFoundState />;

  return (
    <div className="space-y-5 pb-24">
      <BreadcrumbNav items={[{ label: "Customers", href: "/customers" }, { label: customer.name }]} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight">{customer.name}</h1>
            <CustomerAccountBadge hasOnlineAccount={customer.has_online_account} source={customer.source} />
          </div>
          <p className="mt-1 text-sm text-fg/55">
            {customer.business ? `${customer.business.name} · ` : ""}
            Customer since {new Date(customer.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2 self-start">
          <Can permission={PERMISSIONS.customers.update}>
            <Button variant="secondary" size="md" className="gap-2" onClick={() => setFormOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </Can>
          <Can permission={PERMISSIONS.customers.delete}>
            <Button variant="danger" size="md" className="gap-2" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </Can>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* min-w-0: the table's own min-w would widen the page on mobile. */}
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader
              title="Order History"
              description={`${customer.orders.length} order${customer.orders.length !== 1 ? "s" : ""}`}
            />
            {customer.orders.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-fg/50">No orders placed yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-120">
                  <TableHeader>
                    <TableRow>
                      <StickyTableHead size={32}>
                        Invoice #
                      </StickyTableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customer.orders.map((order) => (
                      <TableRow
                        key={order._id}
                        className="group cursor-pointer"
                        onClick={() => navigate(`/orders/${order._id}`)}
                      >
                        <StickyTableCell size={32} className="truncate font-medium text-fg">
                          {formatInvoiceNumber(order.invoice_number_prefix, order.invoice_number)}
                        </StickyTableCell>
                        <TableCell>
                          <OrderChannelBadge channel={order.channel} />
                        </TableCell>
                        <TableCell>
                          <OrderStatusBadge status={order.fulfillment_status} />
                        </TableCell>
                        <TableCell className="text-right text-fg">{formatCurrencyFromCents(order.total)}</TableCell>
                        <TableCell className="text-right text-fg/60">
                          {new Date(order.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Outstanding Invoices"
              description={
                customer.outstanding_invoices.length > 0
                  ? `${customer.outstanding_invoices.length} awaiting payment`
                  : undefined
              }
            />
            {customer.outstanding_invoices.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-fg/50">No outstanding invoices.</div>
            ) : (
              <div className="divide-y divide-border">
                {customer.outstanding_invoices.map((order) => (
                  <div
                    key={order._id}
                    className="flex cursor-pointer items-center justify-between px-5 py-3.5 transition hover:bg-bg-2/40"
                    onClick={() => navigate(`/orders/${order._id}`)}
                  >
                    <div>
                      <div className="font-medium text-fg">{formatInvoiceNumber(order.invoice_number_prefix, order.invoice_number)}</div>
                      <div className="text-xs text-fg/50">
                        {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-danger">{formatCurrencyFromCents(order.total)}</div>
                      <OrderStatusBadge status={order.fulfillment_status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <BusinessRepresentativesCard customer={customer} />

          <Card>
            <CardHeader title="Contact" />
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2.5 text-fg/70">
                <Mail className="h-4 w-4 shrink-0 text-fg/40" />
                <span>{customer.email || "—"}</span>
              </div>
              <div className="flex items-center gap-2.5 text-fg/70">
                <Phone className="h-4 w-4 shrink-0 text-fg/40" />
                <span>{customer.phone || "—"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Shipping address" />
            <CardContent className="text-sm text-fg/70">
              {customer.shipping_address ? (
                <>
                  <div>{customer.shipping_address.address}</div>
                  <div>
                    {customer.shipping_address.suburb} {customer.shipping_address.state}{" "}
                    {customer.shipping_address.postcode}
                  </div>
                </>
              ) : (
                <span className="text-fg/50">No address on file.</span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Billing address" />
            <CardContent className="text-sm text-fg/70">
              {customer.billing_address ? (
                <>
                  <div>{customer.billing_address.address}</div>
                  <div>
                    {customer.billing_address.suburb} {customer.billing_address.state}{" "}
                    {customer.billing_address.postcode}
                  </div>
                </>
              ) : (
                <span className="text-fg/50">Same as shipping address.</span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Summary" />
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-fg/60">Total Orders</span>
                <span className="font-medium text-fg">{customer.orders_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg/60">Outstanding Invoices</span>
                <span className="font-medium text-fg">{customer.outstanding_invoices_count}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <CustomerFormModal open={formOpen} onOpenChange={setFormOpen} customer={customer} />
      <CustomerDeleteModal
        customer={deleteOpen ? customer : null}
        onOpenChange={(open) => setDeleteOpen(open)}
        onDeleted={() => navigate("/customers")}
      />
    </div>
  );
}
