import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/Calendar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { formatDateRangeLabel, formatIsoLabel, toIsoDate, parseIsoDate, getPresetRange } from "@/utils/dateRange";
import type { DateRangeValue } from "@/utils/dateRange";

const DEFAULT_PRESET_DAYS = [7, 14, 30, 90] as const;

// Generic date-range filter: a preset "last N days" list plus a calendar-based custom range (react-day-picker). Used by the Dashboard charts and Activity Log, replacing each one's own hand-rolled native date-input pair.
export function DateRangePicker({
  value,
  onChange,
  presetDays = DEFAULT_PRESET_DAYS,
  placeholder = "Select range",
  allowClear = false,
  align = "end",
  className,
}: {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  presetDays?: readonly number[];
  // Shown as the trigger label when no range is applied — only reachable when `allowClear` is true.
  placeholder?: string;
  // Whether a "Clear" action returns to an unfiltered state — Dashboard charts always need a concrete range so they leave this off; Activity Log's filter is optional.
  allowClear?: boolean;
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(
    value.from && value.to ? { from: parseIsoDate(value.from), to: parseIsoDate(value.to) } : undefined,
  );

  const label = formatDateRangeLabel(value, placeholder);
  const activePresetDays = presetDays.find((days) => {
    const preset = getPresetRange(days);
    return value.from === preset.from && value.to === preset.to;
  });

  function resetDraftToValue() {
    setDraftRange(value.from && value.to ? { from: parseIsoDate(value.from), to: parseIsoDate(value.to) } : undefined);
  }

  function choosePreset(days: number) {
    setDraftRange(undefined);
    onChange(getPresetRange(days));
    setOpen(false);
  }

  function applyCustomRange() {
    if (!draftRange?.from || !draftRange?.to) return;
    onChange({ from: toIsoDate(draftRange.from), to: toIsoDate(draftRange.to) });
    setOpen(false);
  }

  function clearRange() {
    setDraftRange(undefined);
    onChange({});
    setOpen(false);
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Discard an in-progress, un-applied custom pick on close so reopening doesn't show a stale half-made selection.
        if (!next) resetDraftToValue();
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-semibold text-fg shadow-(--shadow-input) transition hover:bg-muted/50",
            className,
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 text-fg/45" />
          {label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={8}
          className={cn(
            "z-50 w-[min(92vw,320px)] overflow-hidden rounded-xl border border-border bg-card shadow-lg",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border p-2">
            {presetDays.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => choosePreset(days)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  activePresetDays === days ? "bg-accent/10 text-accent" : "text-fg/60 hover:bg-muted/60",
                )}
              >
                {days}D
              </button>
            ))}
            {allowClear && (value.from || value.to || draftRange?.from) && (
              <button
                type="button"
                onClick={clearRange}
                className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-fg/45 transition-colors hover:bg-muted/60 hover:text-fg"
              >
                Clear
              </button>
            )}
          </div>

          <Calendar
            mode="range"
            selected={draftRange}
            onSelect={setDraftRange}
            numberOfMonths={1}
            defaultMonth={draftRange?.to ?? draftRange?.from}
            disabled={{ after: new Date() }}
            className="w-full"
          />

          <div className="flex items-center justify-between gap-2 border-t border-border p-2.5">
            <span className="min-w-0 truncate text-xs text-fg/45">
              {draftRange?.from
                ? draftRange.to
                  ? `${formatIsoLabel(toIsoDate(draftRange.from))} – ${formatIsoLabel(toIsoDate(draftRange.to))}`
                  : "Pick an end date…"
                : "Pick a start date…"}
            </span>
            <Button type="button" size="sm" disabled={!draftRange?.from || !draftRange?.to} onClick={applyCustomRange}>
              Apply
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
