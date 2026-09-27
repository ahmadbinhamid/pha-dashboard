import { Card } from "@/components/ui/Card";
import { cn } from "@/utils/cn";
import { STORE_SECTIONS, type StoreSectionId } from "@/config/settingsTabs";

// Pill row inside Store Settings, the second nav level under <SettingsTabBar>. `counts` lets a section show a record count without this component knowing where the number comes from.
export function SettingsSubTabs({
  activeId,
  onSelect,
  counts,
}: {
  activeId: StoreSectionId;
  onSelect: (id: StoreSectionId) => void;
  counts?: Partial<Record<StoreSectionId, number>>;
}) {
  return (
    <Card className="p-1.5">
      <div role="tablist" aria-label="Store settings sections" className="no-scrollbar flex items-center gap-1 overflow-x-auto">
        {STORE_SECTIONS.map((section) => {
          const active = section.id === activeId;
          const count = counts?.[section.id];
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(section.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors",
                active ? "bg-primary text-primary-fg" : "text-fg/60 hover:bg-muted/60 hover:text-fg",
              )}
            >
              {section.icon({ className: "h-4 w-4" })}
              {section.label}
              {count !== undefined ? <span className={cn(active ? "text-primary-fg/75" : "text-fg/40")}>({count})</span> : null}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
