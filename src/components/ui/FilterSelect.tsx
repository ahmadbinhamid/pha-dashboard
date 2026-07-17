import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { cn } from "@/utils/cn";

export interface FilterSelectOption {
  label: string;
  value: string;
}

// Toolbar status/enum filter — a Select dropdown where the first option acts
// as the "no filter applied" state (empty string value, e.g. "All Status").
export function FilterSelect({
  options,
  value,
  onChange,
  className,
}: {
  options: FilterSelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  // Radix Select can't represent an empty-string item value, so the "All"
  // sentinel is passed as "" externally but as "__all__" internally to Radix.
  const ALL = "__all__";
  return (
    <Select
      value={value === "" ? ALL : value}
      onValueChange={(v) => onChange(v === ALL ? "" : v)}
    >
      <SelectTrigger className={cn("h-9 w-auto min-w-36 gap-2 text-sm", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value || ALL} value={o.value === "" ? ALL : o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
