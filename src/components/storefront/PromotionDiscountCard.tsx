import { Link } from "react-router-dom";
import { Controller, useFormContext } from "react-hook-form";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { FeaturedDiscountSummary } from "@/components/storefront/FeaturedDiscountSummary";
import { FlashSaleQuickLaunchMenu } from "@/components/storefront/FlashSaleQuickLaunchMenu";
import { DISCOUNT_STATUS_CONFIG, DISCOUNTS_BASE_PATH } from "@/config/discounts";
import type { FlashSaleFormValues } from "@/lib/validation/storefront";
import type { Category } from "@/types/product";
import type { Discount, FeaturedDiscount } from "@/types/discount";
import type { FlashSalePreset } from "@/types/storefront";

interface PromotionDiscountCardProps {
  discounts: Discount[];
  // The picked discount (saved or unsaved), with categories expanded.
  selected: FeaturedDiscount | null;
  categories: Category[];
  canEdit: boolean;
  // Quick launch needs discounts.create on top of storefront.update.
  canLaunch: boolean;
  busy: boolean;
  onLaunch: (preset: FlashSalePreset, categoryIds: string[]) => void;
}

/** Which discount the storefront advertises, part of the promotion form. */
export function PromotionDiscountCard({ discounts, selected, categories, canEdit, canLaunch, busy, onLaunch }: PromotionDiscountCardProps) {
  const { control } = useFormContext<FlashSaleFormValues>();
  const options = discounts.map((d) => ({
    value: d._id,
    label: `${d.name} · ${d.is_automatic ? "Automatic" : d.code} · ${DISCOUNT_STATUS_CONFIG[d.status].label}`,
  }));

  return (
    <Card>
      <CardHeader
        title="Discount to promote"
        description="Its offer and end date drive the ticker and countdown."
        right={canLaunch ? <FlashSaleQuickLaunchMenu categories={categories} disabled={busy} onLaunch={onLaunch} /> : null}
      />
      <CardContent className="space-y-4">
        <Controller
          control={control}
          name="discount_id"
          render={({ field }) => (
            <SingleSelect
              options={options}
              value={field.value ?? ""}
              onChange={(v) => field.onChange(v || null)}
              placeholder={discounts.length ? "Pick a discount" : "No discounts yet"}
              disabled={!canEdit || !discounts.length}
            />
          )}
        />
        {selected ? (
          <FeaturedDiscountSummary discount={selected} />
        ) : (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-fg/55">
            Pick one of your discounts, or use Quick launch to create one.
          </p>
        )}
        <Link
          to={`${DISCOUNTS_BASE_PATH}/new`}
          className="inline-flex items-center gap-1 text-xs font-medium text-fg/55 transition-colors hover:text-accent"
        >
          <Plus className="h-3.5 w-3.5" />
          Create a new discount
        </Link>
      </CardContent>
    </Card>
  );
}
