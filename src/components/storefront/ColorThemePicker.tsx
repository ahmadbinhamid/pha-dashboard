import { OptionTile } from "@/components/ui/OptionTile";
import { cn } from "@/utils/cn";

interface ColorThemeOption<T extends string> {
  value: T;
  label: string;
  // Background + text classes, empty for the "custom" option.
  className: string;
}

interface ColorThemePickerProps<T extends string> {
  options: readonly ColorThemeOption<T>[];
  value: T;
  onChange: (value: T) => void;
  // Swatch for the "custom" option, so it previews the picked colour.
  customColor: string;
  ariaLabel: string;
  disabled?: boolean;
  // 2 for narrow columns, default spreads across up to six.
  columns?: 2 | 6;
}

/** Preset colour themes plus "Custom", used by the banner and the ticker. */
export function ColorThemePicker<T extends string>({ options, value, onChange, customColor, ariaLabel, disabled, columns = 6 }: ColorThemePickerProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("grid grid-cols-2 gap-2", columns === 6 && "sm:grid-cols-3 lg:grid-cols-6")}
    >
      {options.map((theme) => (
        <OptionTile
          key={theme.value}
          selected={theme.value === value}
          onSelect={() => onChange(theme.value)}
          disabled={disabled}
          showCheck={false}
          className="flex items-center gap-2 p-2 text-xs font-medium"
        >
          {theme.value === "custom" ? (
            <span className="h-6 w-6 shrink-0 rounded-md ring-1 ring-inset ring-border" style={{ backgroundColor: customColor }} />
          ) : (
            <span className={cn("h-6 w-6 shrink-0 rounded-md", theme.className)} />
          )}
          <span className="min-w-0 truncate">{theme.label}</span>
        </OptionTile>
      ))}
    </div>
  );
}
