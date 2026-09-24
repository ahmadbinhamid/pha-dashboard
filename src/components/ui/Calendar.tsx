import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// react-day-picker ships unstyled; every part is mapped onto app tokens here.
export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        // `nav` is an absolute sibling of `month`; `relative` keeps it in the calendar.
        months: "relative flex flex-col gap-4",
        month: "space-y-3",
        // No `relative`: a positioned caption paints over `nav` and eats its clicks.
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
        weekday: "w-9 text-2xs font-medium text-fg/40 uppercase tracking-wide",
        weeks: "",
        week: "flex w-full mt-1",
        // Modifiers go on <td>; `!` makes range_* beat `selected` (on every range day).
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
