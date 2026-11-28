import { useQuery } from "@tanstack/react-query";
import { Globe, MailCheck, MailX, Users } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { CONTACTS_QUERY_KEY, getContactStats } from "@/lib/api/campaigns";

// Headline contact counts; refreshes with any contacts invalidation.
export function ContactStatCards() {
  const { data, isLoading } = useQuery({ queryKey: [...CONTACTS_QUERY_KEY, "stats"], queryFn: getContactStats });
  const stats = data?.data;
  const value = (n: number | undefined) => (stats ? (n ?? 0) : "—");

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard size="sm" label="Contacts" value={value(stats?.total)} icon={<Users className="h-4 w-4" />} loading={isLoading} />
      <MetricCard
        size="sm"
        label="Subscribed"
        value={value(stats?.by_status.subscribed)}
        subLabel="Receive campaigns"
        icon={<MailCheck className="h-4 w-4" />}
        tone="ok"
        loading={isLoading}
      />
      <MetricCard
        size="sm"
        label="Unsubscribed"
        value={value(stats?.by_status.unsubscribed)}
        subLabel="Never emailed again"
        icon={<MailX className="h-4 w-4" />}
        loading={isLoading}
      />
      <MetricCard
        size="sm"
        label="Website signups"
        value={value(stats?.by_source.newsletter)}
        subLabel="From the storefront form"
        icon={<Globe className="h-4 w-4" />}
        loading={isLoading}
      />
    </div>
  );
}
