import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { cn } from "@/utils/cn";
import { useFieldDensity } from "@/components/ui/FieldDensity";

export interface SingleSelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SingleSelectProps {
  // Readonly so `as const` option lists can be passed as-is.
  options: readonly SingleSelectOption[];
  // "" means nothing chosen (or an explicit "" option such as "All").
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  // md: form fields (40px); sm: toolbars and dense rows (36px, auto width).
  size?: "md" | "sm";
  disabled?: boolean;
  id?: string;
  name?: string;
  onBlur?: () => void;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
}

// Radix can't hold "" as an item value, so an explicit "" option maps to this.
const EMPTY = "__empty__";

// The app's one single-value dropdown; pair with MultiSelect / Combobox.
export function SingleSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  size = "md",
  disabled,
  id,
  name,
  onBlur,
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: SingleSelectProps) {
  // Radix shows the placeholder for "", unless an explicit "" option exists.
  const compact = useFieldDensity() === "compact" && size === "md";
  const radixValue = value === "" && options.some((o) => o.value === "") ? EMPTY : value;

  return (
    <Select
      value={radixValue}
      onValueChange={(v) => {
        // Radix's hidden form <select> can emit "" after a form reset; never a pick.
        if (v === "") return;
        onChange(v === EMPTY ? "" : v);
      }}
      disabled={disabled}
      name={name}
      onOpenChange={(open) => !open && onBlur?.()}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        className={cn("gap-2 data-[placeholder]:text-fg/45 aria-invalid:border-danger", size === "sm" && "h-9 w-auto min-w-36", compact && "h-9 text-compact", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value || EMPTY} value={o.value === "" ? EMPTY : o.value} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
