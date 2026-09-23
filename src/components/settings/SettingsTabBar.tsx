import { cn } from "@/utils/cn";
import { SETTINGS_TABS, type SettingsTabId } from "@/config/settingsTabs";

// Underlined horizontal tab bar across the top of Settings. Scrolls sideways rather than wrapping, since nine tabs don't fit a laptop width and wrapping would make the page jump as the active tab changes lines.
export function SettingsTabBar({
  activeId,
  onSelect,
}: {
  activeId: SettingsTabId;
  onSelect: (id: SettingsTabId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Settings sections"
      className="no-scrollbar flex items-center gap-5 overflow-x-auto border-b border-border"
    >
      {SETTINGS_TABS.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(tab.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 pb-3 text-xs font-semibold transition-colors",
              active ? "border-primary text-primary" : "border-transparent text-fg/55 hover:text-fg",
            )}
          >
            {tab.icon({ className: "h-3.5 w-3.5" })}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
