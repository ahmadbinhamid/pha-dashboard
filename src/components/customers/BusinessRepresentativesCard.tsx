import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "@/components/ui/Link";
import { Can } from "@/components/auth/Can";
import { PERMISSIONS } from "@/config/permissions";
import { CustomerFormModal } from "@/components/customers/CustomerFormModal";
import type { CustomerDetail } from "@/types/customer";

interface BusinessRepresentativesCardProps {
  customer: CustomerDetail;
}

// The rest of this customer's business, each rep a separately billable record.
export function BusinessRepresentativesCard({ customer }: BusinessRepresentativesCardProps) {
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);

  if (!customer.business) return null;
  const others = customer.representatives;

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Business"
        description={
          <Link href={`/businesses/${customer.business._id}`} className="text-accent hover:underline">
            {customer.business.name}
          </Link>
        }
        right={
          <Can permission={PERMISSIONS.customers.create}>
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setFormOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              Add rep
            </Button>
          </Can>
        }
      />
      {others.length === 0 ? (
        <div className="px-5 pb-5 text-sm text-fg/50">No other representatives.</div>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {others.map((rep) => (
            <div
              key={rep._id}
              className="cursor-pointer px-5 py-3 transition hover:bg-bg-2/40"
              onClick={() => navigate(`/customers/${rep._id}`)}
            >
              <div className="truncate text-sm font-medium text-fg">{rep.name}</div>
              <div className="truncate text-xs text-fg/50">{rep.email || rep.phone || "No contact info"}</div>
            </div>
          ))}
        </div>
      )}

      <CustomerFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={null}
        initialBusinessName={customer.business.name}
        onCreated={(created) => navigate(`/customers/${created._id}`)}
      />
    </Card>
  );
}
