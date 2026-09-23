import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// react-day-picker ships unstyled (no default CSS) — every part is targeted
// via `classNames` using the library's own UI/DayFlag/SelectionState key
// names, mapped onto this app's own tokens rather than react-day-picker's
// (nonexistent) default look or a copy-pasted arbitrary palette.
export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        // `nav` (the prev/next chevrons) is rendered by react-day-picker as a
        // sibling of `month`, not nested inside it, and is positioned
        // `absolute inset-x-0 top-0` — without `relative` here it escapes all
        // the way up to the nearest positioned ancestor (Popover.Content),
        // landing at the very top of the whole popover and overlapping
        // whatever sits above the calendar (e.g. the preset-day chips row).
        months: "relative flex flex-col gap-4",
        month: "space-y-3",
        // No `relative` here (unlike a typical shadcn Calendar) — this box is
        // full-width (flex + justify-center) even though its visible text is
        // centered, and giving it `position` would make it a *positioned*
        // descendant painted in the same stacking layer as `nav` below. Since
        // `nav` renders first in the DOM, month_caption's invisible full-width
        // box would then paint on top of it and silently eat clicks on the
        // prev/next chevrons — found by seeing the chevrons render but never fire onClick.
        month_caption: "flex items-center justify-center pt-1",
        caption_label: "text-sm font-semibold text-fg",
        nav: "absolute inset-x-0 top-0 z-10 flex items-center justify-between",
        button_previous: cn(
          "h-7 w-7 rounded-md flex items-center justify-center text-fg/50 transition hover:bg-muted/60 hover:text-fg disabled:opacity-30",
        ),
        button_next: cn(
          "h-7 w-7 rounded-md flex items-center justify-center text-fg/50 transition hover:bg-muted/60 hover:text-fg disabled:opacity-30",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-[11px] font-medium text-fg/40 uppercase tracking-wide",
        weeks: "",
        week: "flex w-full mt-1",
        // The "connected band" look (one continuous orange shape across the
        // whole range, not separate per-day dots) comes from styling the
        // DAY CELL (this `day` key and the range_*/selected modifier keys
        // below) — react-day-picker applies every modifier class to the
        // <td>, never to the button inside it (confirmed straight from its
        // source: DayButton only ever gets the static `day_button` class,
        // nothing modifier-aware).
        //
        // Important subtlety, found by inspecting the actual rendered
        // classes rather than assuming: react-day-picker marks EVERY day in
        // an active range as `selected` too — a range's middle days get
        // both `range_middle` AND `selected` at once, not just start/end.
        // Since selected's rounded-full/bg-accent and range_middle's
        // flat/bg-accent-15 are plain (non-!important) classes fighting
        // over the same properties, which one visually won was left up to
        // Tailwind's internal stylesheet order — not the order these
        // classes appear in the class list — and in testing it picked the
        // wrong one for the corners specifically (every range day rendered
        // fully rounded, not just the two ends). The `!` important suffix
        // on range_start/range_middle/range_end's conflicting declarations
        // makes them win unconditionally, which is what actually makes this
        // deterministic instead of "worked by luck in one browser."
        day: "h-9 w-9 p-0 text-center text-sm relative",
        day_button: cn(
          "relative z-10 h-9 w-9 rounded-full p-0 font-normal text-fg transition-colors",
          "hover:bg-muted/70",
          "outline-none! focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
        ),
        range_start:
          "rounded-l-full! rounded-r-none! bg-accent/15! [&>button]:bg-accent! [&>button]:text-accent-fg [&>button]:hover:bg-accent",
        range_end:
          "rounded-r-full! rounded-l-none! bg-accent/15! [&>button]:bg-accent! [&>button]:text-accent-fg [&>button]:hover:bg-accent",
        range_middle: "rounded-none! bg-accent/15! [&>button]:bg-transparent! [&>button]:text-fg [&>button]:hover:bg-accent/25",
        selected: "rounded-full bg-accent [&>button]:bg-accent [&>button]:text-accent-fg [&>button]:hover:bg-accent",
        today: "[&>button]:font-semibold [&>button]:text-accent",
        outside: "text-fg/25",
        disabled: "text-fg/20 opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("h-4 w-4", chevronClassName)} />
          ) : (
            <ChevronRight className={cn("h-4 w-4", chevronClassName)} />
          ),
      }}
      {...props}
    />
  );
}
