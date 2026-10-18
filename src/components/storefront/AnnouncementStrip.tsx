import { ArrowRight, X } from "lucide-react";
import { ANNOUNCEMENT_ICON_OPTIONS, announcementThemeStyle } from "@/config/storefront";
import type { Announcement } from "@/types/storefront";
import { cn } from "@/utils/cn";

// Preview only: the live storefront makes the whole strip the link.
export function AnnouncementStrip({ announcement, className }: { announcement: Announcement; className?: string }) {
  const theme = announcementThemeStyle(announcement);
  const Icon = announcement.icon === "none" ? null : ANNOUNCEMENT_ICON_OPTIONS.find((o) => o.value === announcement.icon)?.icon;
  return (
    <div
      className={cn("relative flex items-center justify-center gap-2 px-8 py-2 text-center text-2xs font-medium", theme.className, className)}
      style={theme.style}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
      <span className="min-w-0 truncate">{announcement.message || "Your announcement appears here"}</span>
      {announcement.link_url ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-semibold ring-1 ring-current/40 ring-inset">
          {announcement.link_label || "Shop now"}
          <ArrowRight className="h-3 w-3" />
        </span>
      ) : null}
      {announcement.dismissible ? <X className="absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 opacity-70" /> : null}
    </div>
  );
}
