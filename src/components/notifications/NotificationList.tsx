import { Bell } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { useNotificationFeed } from "@/hooks/useNotifications";
import type { AppNotification, NotificationTab } from "@/types/notification";

const EMPTY_DESCRIPTION: Record<NotificationTab, string> = {
  all: "New orders and invoice alerts will show up here.",
  orders: "New storefront, eBay and in-store orders will show up here.",
  invoices: "Overdue business account invoices will show up here.",
};

interface NotificationListProps {
  tab: NotificationTab;
  onSelect: (notification: AppNotification) => void;
}

export function NotificationList({ tab, onSelect }: NotificationListProps) {
  const { data, isLoading } = useNotificationFeed(tab);
  const items = data?.data?.items ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (!items.length) {
    return <EmptyState icon={Bell} title="You're all caught up" description={EMPTY_DESCRIPTION[tab]} className="py-10" />;
  }
  return (
    <div className="max-h-96 divide-y divide-border overflow-y-auto">
      {items.map((n) => (
        <NotificationItem key={n._id} notification={n} onSelect={onSelect} />
      ))}
    </div>
  );
}
