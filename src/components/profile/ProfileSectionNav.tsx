import { KeyRound, User } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/utils/cn";

export type ProfileSectionId = "profile" | "password";

const SECTIONS: { id: ProfileSectionId; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "password", label: "Change Password", icon: KeyRound },
];

export function findProfileSection(id?: string | null): ProfileSectionId {
  return SECTIONS.some((s) => s.id === id) ? (id as ProfileSectionId) : "profile";
}

// Side nav for the Profile page.
//
// Rows, not pills: a pill shrink-wraps its label, so the two items ended up
// different widths inside a card that didn't fill its column. These fill the
// width and mark the active one the way the app's own sidebar does — a tinted
// row, not a saturated block.
//
// Below `lg` it collapses to a horizontal strip, since a two-item column above
// the form is wasted height on a phone — and everything in that strip (card
// padding, row padding, icon tile, label) steps down a size there too, so the
// nav stays a thin band rather than a second header.
export function ProfileSectionNav({
  activeId,
  onSelect,
}: {
  activeId: ProfileSectionId;
  onSelect: (id: ProfileSectionId) => void;
}) {
  return (
    <Card className="p-1.5 lg:p-2">
      <p className="hidden px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg/35 lg:block">
        Personal
      </p>

      <div
        role="tablist"
        aria-label="Profile sections"
        className="no-scrollbar flex items-center gap-1 overflow-x-auto lg:flex-col lg:items-stretch lg:gap-0.5 lg:overflow-visible"
      >
        {SECTIONS.map((section) => {
          const active = section.id === activeId;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(section.id)}
              className={cn(
                "group flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-2 py-1.5 text-left transition-colors",
                "lg:w-full lg:shrink lg:gap-2.5 lg:px-2.5 lg:py-2",
                active ? "bg-accent/10" : "hover:bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-md transition-colors lg:h-7 lg:w-7 lg:rounded-lg",
                  active ? "bg-accent text-accent-fg" : "bg-muted text-fg/50 group-hover:text-fg/70",
                )}
              >
                <section.icon className="h-3 w-3 lg:h-3.5 lg:w-3.5" />
              </span>

              <span
                className={cn(
                  "min-w-0 truncate text-xs font-semibold transition-colors lg:text-[13px]",
                  active ? "text-accent" : "text-fg/75 group-hover:text-fg",
                )}
              >
                {section.label}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
