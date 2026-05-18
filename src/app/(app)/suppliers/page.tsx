import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function SuppliersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Suppliers</h1>
        <p className="mt-1 text-sm text-fg/70">Supplier contacts, lead times, and price lists.</p>
      </div>

      <Card>
        <CardHeader title="Suppliers" description="UI placeholder for supplier management." />
        <CardContent>
          <EmptyState
            title="No suppliers configured"
            description="Add suppliers to power purchasing workflows and smarter reorder suggestions."
            actionLabel="Add supplier"
            actionHref="#"
          />
        </CardContent>
      </Card>
    </div>
  );
}

