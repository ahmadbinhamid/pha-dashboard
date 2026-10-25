import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "@/components/ui/Link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { NotificationList } from "@/components/notifications/NotificationList";
import { NOTIFICATION_TABS } from "@/config/notifications";
import type { AppNotification, NotificationCategory, NotificationTab } from "@/types/notification";

interface NotificationPanelProps {
  unreadCount: number;
  unreadByCategory: Record<NotificationCategory, number> | undefined;
  onSelect: (notification: AppNotification) => void;
  onMarkAllRead: (tab: NotificationTab) => void;
  onNavigate: () => void;
}

export function NotificationPanel({
  unreadCount,
  unreadByCategory,
  onSelect,
  onMarkAllRead,
  onNavigate,
}: NotificationPanelProps) {
  const [tab, setTab] = useState<NotificationTab>("all");
  const unreadFor = (value: NotificationTab) => (value === "all" ? unreadCount : (unreadByCategory?.[value] ?? 0));

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as NotificationTab)}>
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="text-sm font-semibold text-fg">Notifications</span>
        {unreadFor(tab) > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMarkAllRead(tab)}
            className="h-auto px-1.5 py-0.5 text-xs font-medium text-accent hover:underline"
          >
            Mark all read
          </Button>
        )}
      </div>

      <TabsList className="mt-1 gap-4 px-4">
        {NOTIFICATION_TABS.map(({ value, label }) => (
          <TabsTrigger key={value} value={value} className="text-xs">
            {label}
            {unreadFor(value) > 0 && (
              <Badge className="bg-accent/15 px-1.5 py-0 text-3xs leading-4 text-accent ring-0">
                {unreadFor(value) > 99 ? "99+" : unreadFor(value)}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {NOTIFICATION_TABS.map(({ value }) => (
        <TabsContent key={value} value={value} className="mt-0">
          <NotificationList tab={value} onSelect={onSelect} />
        </TabsContent>
      ))}

      <div className="border-t border-border px-4 py-2">
        <Link
          href="/settings/notifications"
          onClick={onNavigate}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-fg/60 hover:text-fg"
        >
          <Settings className="h-3.5 w-3.5" />
          Notification settings
        </Link>
      </div>
    </Tabs>
  );
}
