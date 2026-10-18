import { OptionTile } from "@/components/ui/OptionTile";
import { DISCOUNT_METHODS } from "@/config/discounts";

type Method = (typeof DISCOUNT_METHODS)[number]["value"];

interface DiscountMethodPickerProps {
  value: Method;
  onChange: (method: Method) => void;
  disabled?: boolean;
}

/** Promo code vs automatic deal, each explained, as two choice cards. */
export function DiscountMethodPicker({ value, onChange, disabled }: DiscountMethodPickerProps) {
  return (
    <div role="radiogroup" aria-label="How shoppers get it" className="grid gap-3 sm:grid-cols-2">
      {DISCOUNT_METHODS.map(({ value: method, label, icon: Icon, description, example }) => (
        <OptionTile key={method} selected={value === method} onSelect={() => onChange(method)} disabled={disabled} className="p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-fg">{label}</span>
          </div>
          <p className="mt-2 text-xs text-fg/70">{description}</p>
          <p className="mt-1 text-xs text-fg/45">{example}</p>
        </OptionTile>
      ))}
    </div>
  );
}
