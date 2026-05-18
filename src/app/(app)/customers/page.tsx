import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Customers</h1>
        <p className="mt-1 text-sm text-fg/70">Customer profiles, order history, and notes.</p>
      </div>

      <Card>
        <CardHeader title="Customers" description="UI placeholder for customer management." />
        <CardContent>
          <EmptyState
            title="No customer data yet"
            description="Once you connect sales channels, customer records will appear here."
            actionLabel="View Orders"
            actionHref="/orders"
          />
        </CardContent>
      </Card>
    </div>
  );
}

