import { cn } from "@/utils/cn";
import type { SettingsTab, SettingsTabId } from "@/config/settingsTabs";

// Scrolls sideways, not wrapping, so the page never jumps between tabs.
export function SettingsTabBar({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: SettingsTab[];
  activeId: SettingsTabId;
  onSelect: (id: SettingsTabId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Settings sections"
      className="no-scrollbar flex items-center gap-5 overflow-x-auto border-b border-border"
    >
      {tabs.map((tab) => {
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
