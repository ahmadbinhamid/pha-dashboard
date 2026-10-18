import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ColorSwatchInput } from "@/components/ui/ColorSwatchInput";
import { FormField } from "@/components/ui/FormField";
import { FormSubsection } from "@/components/shared/FormSubsection";
import { ColorThemePicker } from "@/components/storefront/ColorThemePicker";
import { SaleBadge } from "@/components/storefront/SaleBadge";
import { SaleCardPreview } from "@/components/storefront/SaleCardPreview";
import { PROMO_THEMES } from "@/config/storefront";
import { saleHeadline } from "@/lib/storefront/salePricing";
import type { FlashSaleFormValues } from "@/lib/validation/storefront";
import type { FeaturedDiscount } from "@/types/discount";

type Part = "card" | "badge";

interface PromotionStyleCardProps {
  // The picked discount, so the previews show its real offer and code.
  discount: FeaturedDiscount | null;
  canEdit: boolean;
}

/** Colours for the product page sale card and the product sale badges. */
export function PromotionStyleCard({ discount, canEdit }: PromotionStyleCardProps) {
  const { control, formState: { errors } } = useFormContext<FlashSaleFormValues>();
  const v = useWatch({ control }) as FlashSaleFormValues;
  const headline = discount ? saleHeadline(discount) : "20% OFF";
  const badgeText = discount?.discount_type === "percent" ? `-${discount.discount_value}%` : "Sale";

  const themeField = (part: Part, label: string) => (
    <FormField label={label}>
      <Controller
        control={control}
        name={`${part}_theme` as const}
        render={({ field }) => (
          <ColorThemePicker
            options={PROMO_THEMES}
            value={field.value}
            onChange={field.onChange}
            customColor={v[`${part}_bg_color` as const]}
            ariaLabel={label}
            disabled={!canEdit}
            columns={2}
          />
        )}
      />
    </FormField>
  );
  const customColors = (part: Part) =>
    v[`${part}_theme` as const] === "custom" ? (
      <div className="grid gap-4 sm:grid-cols-2">
        {(["bg", "text"] as const).map((kind) => {
          const name = `${part}_${kind}_color` as const;
          return (
            <FormField key={name} label={kind === "bg" ? "Background" : "Text"} error={errors[name]?.message}>
              <Controller control={control} name={name} render={({ field }) => <ColorSwatchInput value={field.value} onChange={field.onChange} />} />
            </FormField>
          );
        })}
      </div>
    ) : null;

  return (
    <Card>
      <CardHeader title="Sale card & badge colours" description="Match the promotion to your brand. Previews use the picked discount." />
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <FormSubsection title="Sale card on product pages">
          <SaleCardPreview theme={v.card_theme} bgColor={v.card_bg_color} textColor={v.card_text_color} headline={headline} code={discount?.code ?? null} />
          {themeField("card", "Card colours")}
          {customColors("card")}
        </FormSubsection>
        <FormSubsection title="Sale badge on products">
          <div className="flex h-24 items-center justify-center gap-3 rounded-xl border border-border bg-bg-2/40">
            <SaleBadge theme={v.badge_theme} bgColor={v.badge_bg_color} textColor={v.badge_text_color} className="text-xs">
              {badgeText}
            </SaleBadge>
            <SaleBadge theme={v.badge_theme} bgColor={v.badge_bg_color} textColor={v.badge_text_color} className="text-xs">
              Save A$40.40
            </SaleBadge>
          </div>
          {themeField("badge", "Badge colours")}
          {customColors("badge")}
        </FormSubsection>
      </CardContent>
    </Card>
  );
}
