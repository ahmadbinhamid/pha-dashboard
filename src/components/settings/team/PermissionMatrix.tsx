import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/utils/cn";
import type { PermissionGroup } from "@/types/access";

/** The permission grid, grouped by area. Catalogue is served (GET /roles/permissions), not duplicated, so what can be ticked always matches what the server accepts. `readOnly` renders a system role: shown for reference, can't be changed. */
export function PermissionMatrix({
  groups,
  selected,
  onChange,
  readOnly = false,
}: {
  groups: PermissionGroup[];
  selected: string[];
  onChange: (next: string[]) => void;
  readOnly?: boolean;
}) {
  const has = (permission: string) => selected.includes(permission);

  const toggle = (permission: string) => {
    if (readOnly) return;
    onChange(has(permission) ? selected.filter((p) => p !== permission) : [...selected, permission]);
  };

  const toggleGroup = (group: PermissionGroup) => {
    if (readOnly) return;
    const keys = Object.keys(group.actions).map((action) => `${group.key}.${action}`);
    const allOn = keys.every(has);
    onChange(allOn ? selected.filter((p) => !keys.includes(p)) : [...new Set([...selected, ...keys])]);
  };

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const keys = Object.keys(group.actions).map((action) => `${group.key}.${action}`);
        const onCount = keys.filter(has).length;

        return (
          <div key={group.key} className="rounded-xl border border-border">
            <div className="flex items-start justify-between gap-4 border-b border-border bg-muted/40 px-4 py-3">
              <div className="min-w-0">
                <h3 className="text-xs font-bold uppercase tracking-wide text-fg">{group.label}</h3>
                <p className="mt-0.5 text-xs text-fg/55">{group.description}</p>
              </div>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => toggleGroup(group)}
                className={cn(
                  "shrink-0 text-xs font-semibold text-accent transition-colors hover:text-accent/80",
                  readOnly && "cursor-not-allowed opacity-40",
                )}
              >
                {onCount === keys.length ? "Clear all" : "Select all"}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
              {Object.entries(group.actions).map(([action, label]) => {
                const permission = `${group.key}.${action}`;
                return (
                  <Checkbox
                    key={permission}
                    checked={has(permission)}
                    disabled={readOnly}
                    onChange={() => toggle(permission)}
                    label={label}
                    // The raw key, so what's being granted is unambiguous — the same string the API enforces.
                    description={permission}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
