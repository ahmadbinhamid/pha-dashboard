import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getNotificationPreferences, updateNotificationPreferences } from "@/lib/api/notifications";
import { useToast } from "@/context";
import type { BeResponse } from "@/lib/api/base";
import type { NotificationPreferences, NotificationPreferencesUpdate } from "@/types/notification";

// Not under ["notifications"], so feed invalidations leave settings alone.
export const NOTIFICATION_PREFERENCES_QUERY_KEY = ["notification-preferences"] as const;

type PreferencesCache = BeResponse<NotificationPreferences> | undefined;

function applyUpdate(cache: PreferencesCache, update: NotificationPreferencesUpdate): PreferencesCache {
  if (!cache?.data) return cache;
  return {
    ...cache,
    data: {
      ...cache.data,
      ...(update.show_toasts !== undefined && { show_toasts: update.show_toasts }),
      events: { ...cache.data.events, ...update.events },
    },
  };
}

/** The signed-in user's settings, saved per toggle with instant feedback. */
export function useNotificationPreferences({ enabled = true }: { enabled?: boolean } = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY,
    queryFn: getNotificationPreferences,
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onMutate: async (update) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY });
      const previous = queryClient.getQueryData<PreferencesCache>(NOTIFICATION_PREFERENCES_QUERY_KEY);
      queryClient.setQueryData<PreferencesCache>(NOTIFICATION_PREFERENCES_QUERY_KEY, (c) => applyUpdate(c, update));
      return { previous };
    },
    onError: (err: Error, _update, context) => {
      queryClient.setQueryData(NOTIFICATION_PREFERENCES_QUERY_KEY, context?.previous);
      toast({ title: "Couldn't save notification settings", description: err.message, tone: "danger" });
    },
    onSuccess: (res) => queryClient.setQueryData(NOTIFICATION_PREFERENCES_QUERY_KEY, res),
  });

  return { preferences: query.data?.data, isLoading: query.isLoading, update: mutation.mutate, isSaving: mutation.isPending };
}
