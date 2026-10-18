import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ColorSwatchInput } from "@/components/ui/ColorSwatchInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ColorThemePicker } from "@/components/storefront/ColorThemePicker";
import { SaleTicker } from "@/components/storefront/SaleTicker";
import { TICKER_SPEED_OPTIONS, TICKER_THEMES } from "@/config/storefront";
import { saleTickerText } from "@/lib/storefront/salePricing";
import type { FlashSaleFormValues } from "@/lib/validation/storefront";
import type { PromotedSale } from "@/types/storefront";

interface PromotionTickerCardProps {
  // What the ticker would show with the current edits, null if nothing live.
  preview: PromotedSale | null;
  canEdit: boolean;
}

/** The scrolling sale strip: live preview on top, its settings below. */
export function PromotionTickerCard({ preview, canEdit }: PromotionTickerCardProps) {
  const { control, register, formState: { errors } } = useFormContext<FlashSaleFormValues>();
  const [theme, bgColor] = useWatch({ control, name: ["ticker_theme", "ticker_bg_color"] });

  const colorField = (name: "ticker_bg_color" | "ticker_text_color", label: string) => (
    <FormField label={label} error={errors[name]?.message}>
      <Controller control={control} name={name} render={({ field }) => <ColorSwatchInput value={field.value} onChange={field.onChange} />} />
    </FormField>
  );

  return (
    <Card>
      <CardHeader title="Ticker" description="Scrolls under the hero on your home page." />
      <div className="border-b border-border bg-bg-2/40 px-4 py-4 sm:px-5">
        {preview ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <SaleTicker sale={preview} />
          </div>
        ) : (
          <p className="text-center text-sm text-fg/55">The preview appears once a live discount is picked and the promotion is on.</p>
        )}
      </div>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <FormField
            label="Text"
            hint={preview ? `Blank shows: ${saleTickerText({ ...preview, ticker_text: "" })}` : "Blank uses the offer and code"}
          >
            <Input {...register("ticker_text")} maxLength={160} placeholder="⚡ FLASH SALE: 20% off everything with code FLASH20" />
          </FormField>
          <FormField label="Speed">
            <Controller
              control={control}
              name="ticker_speed"
              render={({ field }) => <SegmentedControl options={TICKER_SPEED_OPTIONS} value={field.value} onChange={field.onChange} ariaLabel="Ticker speed" />}
            />
          </FormField>
        </div>
        <div className="space-y-4">
          <FormField label="Colours">
            <Controller
              control={control}
              name="ticker_theme"
              render={({ field }) => (
                <ColorThemePicker
                  options={TICKER_THEMES}
                  value={field.value}
                  onChange={field.onChange}
                  customColor={bgColor}
                  ariaLabel="Ticker colours"
                  disabled={!canEdit}
                  columns={2}
                />
              )}
            />
          </FormField>
          {theme === "custom" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {colorField("ticker_bg_color", "Background")}
              {colorField("ticker_text_color", "Text")}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
