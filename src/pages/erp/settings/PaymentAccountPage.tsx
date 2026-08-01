import { PageHeader } from "@/components/shared/PageHeader";
import { StripeConnectCard } from "@/components/tenant-settings/StripeConnectCard";

export default function PaymentAccountPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Payment Account" />
      <StripeConnectCard />
    </div>
  );
}
