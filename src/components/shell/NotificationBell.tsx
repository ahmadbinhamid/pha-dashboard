import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/Popover";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { useNotificationFeed, useNotificationReadActions } from "@/hooks/useNotifications";
import type { AppNotification } from "@/types/notification";

// Popover, not a menu: the panel holds tabs and a scrolling list.
export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // The "all" feed carries every unread count, for the badge and the tabs.
  const { data } = useNotificationFeed("all");
  const { markRead, markAllRead } = useNotificationReadActions();
  const unreadCount = data?.data?.unread_count ?? 0;

  function handleSelect(notification: AppNotification) {
    markRead(notification);
    setOpen(false);
    navigate(`/orders/${notification.data.order_id}`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 shrink-0"
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-3xs font-semibold leading-none text-accent-fg">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[92vw] p-0">
        <NotificationPanel
          unreadCount={unreadCount}
          unreadByCategory={data?.data?.unread_by_category}
          onSelect={handleSelect}
          onMarkAllRead={(tab) => void markAllRead(tab)}
          onNavigate={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
