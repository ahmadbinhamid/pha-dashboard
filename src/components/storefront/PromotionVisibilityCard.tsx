import { Controller, useFormContext } from "react-hook-form";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import type { FlashSaleFormValues } from "@/lib/validation/storefront";

const PLACEMENTS = [
  { name: "show_countdown", label: "Countdown clock", description: "In the ticker and sale card. Needs an end date." },
  { name: "show_hero_card", label: "Sale card on the hero", description: "Beside the slide text, on wide screens." },
  { name: "show_product_badges", label: "Product badges", description: "Sale tags, plus crossed out prices for automatic deals." },
] as const;

/** Which storefront spots advertise the promotion. */
export function PromotionVisibilityCard({ canEdit }: { canEdit: boolean }) {
  const { control } = useFormContext<FlashSaleFormValues>();
  return (
    <Card>
      <CardHeader title="Where it shows" description="The ticker always shows while the promotion is on." />
      <CardContent className="space-y-2">
        {PLACEMENTS.map(({ name, label, description }) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit} label={label} description={description} />
            )}
          />
        ))}
      </CardContent>
    </Card>
  );
}
