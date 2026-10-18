import { OptionTile } from "@/components/ui/OptionTile";
import { DISCOUNT_TEMPLATES } from "@/config/discounts";

type Template = (typeof DISCOUNT_TEMPLATES)[number];

/** Empty-state starter cards, same templates as the "New discount" menu. */
export function DiscountTemplateGrid({ onPick }: { onPick: (template: Template) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {DISCOUNT_TEMPLATES.map((t) => (
        <OptionTile key={t.id} selected={false} showCheck={false} onSelect={() => onPick(t)} className="p-4">
          <t.icon className="h-5 w-5 text-accent" />
          <p className="mt-2 text-sm font-semibold text-fg">{t.label}</p>
          <p className="mt-0.5 text-xs text-fg/55">{t.description}</p>
        </OptionTile>
      ))}
    </div>
  );
}
