import { useState } from "react";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { Switch } from "@/components/ui/Switch";
import { Skeleton } from "@/components/ui/Skeleton";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { NOTIFICATION_EVENT_OPTIONS } from "@/config/notifications";
import type { NotificationEvent } from "@/types/notification";

// Personal, unlike the store-wide tabs: each toggle saves for this user only.
export function NotificationsTab() {
  const { preferences, isLoading, update } = useNotificationPreferences();
  // Which switch is mid-save, so only that one shows the spinner.
  const [savingKey, setSavingKey] = useState<string | null>(null);

  function save(key: string, change: Parameters<typeof update>[0]) {
    setSavingKey(key);
    update(change, { onSettled: () => setSavingKey(null) });
  }

  if (isLoading || !preferences) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="What notifies you"
        description="Choose which events appear in your notification bell. These settings are just for you."
      >
        <div className="space-y-3">
          {NOTIFICATION_EVENT_OPTIONS.map(({ event, label, description }) => (
            <Switch
              key={event}
              checked={preferences.events[event]}
              onCheckedChange={(on) => save(event, { events: { [event]: on } as Record<NotificationEvent, boolean> })}
              loading={savingKey === event}
              label={label}
              description={description}
            />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="How you're notified" description="The bell always updates; pop-ups are optional.">
        <Switch
          checked={preferences.show_toasts}
          onCheckedChange={(on) => save("show_toasts", { show_toasts: on })}
          loading={savingKey === "show_toasts"}
          label="Pop-up alerts"
          description="Show a pop-up on screen when a new notification arrives."
        />
      </SettingsSection>
    </div>
  );
}
