import { useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Calendar } from "@/components/ui/Calendar";
import { Input } from "@/components/ui/Input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { cn } from "@/utils/cn";
import { combineDateAndTime, formatDateTimeLabel, timeOfDay } from "@/utils/dateTime";

interface DateTimePickerProps {
  // ISO string, or null for unset.
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  // Time used when a day is first picked, e.g. "23:59" for an end date.
  defaultTime?: string;
  // Days before this can't be picked.
  minDate?: Date;
  allowClear?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/** Single date + time field on the app's Calendar, see DateRangePicker. */
export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  defaultTime = "00:00",
  minDate,
  allowClear = true,
  disabled,
  id,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value) : undefined;
  const time = value ? timeOfDay(value) : defaultTime;

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="secondary"
            disabled={disabled}
            className={cn("h-10 w-full justify-start gap-2 rounded-xl px-3 font-normal", allowClear && value && "pr-9")}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 text-fg/45" />
            <span className={cn("truncate", !value && "text-fg/45")}>{value ? formatDateTimeLabel(value) : placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(92vw,320px)]">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(day) => day && onChange(combineDateAndTime(day, time))}
            defaultMonth={selected ?? minDate}
            disabled={minDate ? { before: minDate } : undefined}
            className="w-full"
          />
          <div className="flex items-center gap-2 border-t border-border p-3">
            <Input
              type="time"
              size="sm"
              value={time}
              disabled={!value}
              aria-label="Time"
              onChange={(e) => value && e.target.value && onChange(combineDateAndTime(new Date(value), e.target.value))}
            />
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {allowClear && value && !disabled ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear date"
          onClick={() => onChange(null)}
          className="absolute top-1/2 right-1.5 h-7 w-7 -translate-y-1/2 rounded-md text-fg/40 hover:text-fg"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
