import { SettingsView } from "@/components/settings/settings-view";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-fg/70">
          Configure company profile, integrations, users, notifications, and theme preferences.
        </p>
      </div>

      <SettingsView />
    </div>
  );
}

