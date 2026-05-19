import { OrdersTable } from "@/components/orders/orders-table";

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Orders</h1>
        <p className="mt-1 text-sm text-fg/70">
          Review order status, customer details, and shipping tracking at a glance.
        </p>
      </div>

      <OrdersTable />
    </div>
  );
}
