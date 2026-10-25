import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api/notifications";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_PAGE_SIZE, NOTIFICATION_TYPE_CATEGORY } from "@/config/notifications";
import type { BeResponse } from "@/lib/api/base";
import type {
  AppNotification,
  NotificationCategory,
  NotificationListResponse,
  NotificationTab,
} from "@/types/notification";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

// Socket push is primary; this refetch is only a fallback if the socket drops.
const FALLBACK_REFETCH_MS = 60_000;

type FeedCache = BeResponse<NotificationListResponse> | undefined;

const categoryOf = (tab: NotificationTab) => (tab === "all" ? undefined : tab);

/** First page of one bell tab, each tab cached under its own key. */
export function useNotificationFeed(tab: NotificationTab) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, { tab }],
    queryFn: () => getNotifications({ page: 1, limit: NOTIFICATION_PAGE_SIZE, category: categoryOf(tab) }),
    refetchInterval: FALLBACK_REFETCH_MS,
  });
}

/** Marks one item read in every cached tab and drops its unread counts. */
function markOneRead(cache: FeedCache, notification: AppNotification): FeedCache {
  if (!cache?.data) return cache;
  const category = NOTIFICATION_TYPE_CATEGORY[notification.type];
  const readAt = new Date().toISOString();
  return {
    ...cache,
    data: {
      ...cache.data,
      unread_count: Math.max(0, cache.data.unread_count - 1),
      unread_by_category: {
        ...cache.data.unread_by_category,
        [category]: Math.max(0, (cache.data.unread_by_category[category] ?? 0) - 1),
      },
      items: cache.data.items.map((n) => (n._id === notification._id ? { ...n, read_at: readAt } : n)),
    },
  };
}

/** Marks a whole tab read in every cached tab; "all" clears everything. */
function markTabRead(cache: FeedCache, tab: NotificationTab): FeedCache {
  if (!cache?.data) return cache;
  const inTab = (n: AppNotification) => tab === "all" || NOTIFICATION_TYPE_CATEGORY[n.type] === tab;
  const byCategory = cache.data.unread_by_category;
  const cleared = tab === "all" ? cache.data.unread_count : (byCategory[tab] ?? 0);
  const readAt = new Date().toISOString();
  return {
    ...cache,
    data: {
      ...cache.data,
      unread_count: Math.max(0, cache.data.unread_count - cleared),
      unread_by_category:
        tab === "all"
          ? (Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, 0])) as Record<NotificationCategory, number>)
          : { ...byCategory, [tab]: 0 },
      items: cache.data.items.map((n) => (inTab(n) ? { ...n, read_at: n.read_at ?? readAt } : n)),
    },
  };
}

// Optimistic, so a stale "unread" state never lingers after the panel closes.
export function useNotificationReadActions() {
  const queryClient = useQueryClient();
  const refetch = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });

  function markRead(notification: AppNotification) {
    if (notification.read_at) return;
    queryClient.setQueriesData<FeedCache>({ queryKey: NOTIFICATIONS_QUERY_KEY }, (c) => markOneRead(c, notification));
    markNotificationRead(notification._id).catch(refetch);
  }

  async function markAllRead(tab: NotificationTab) {
    queryClient.setQueriesData<FeedCache>({ queryKey: NOTIFICATIONS_QUERY_KEY }, (c) => markTabRead(c, tab));
    try {
      await markAllNotificationsRead(categoryOf(tab));
    } finally {
      void refetch();
    }
  }

  return { markRead, markAllRead };
}
