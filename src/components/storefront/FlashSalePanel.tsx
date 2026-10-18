import { useEffect, useMemo } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UnsavedChangesBar } from "@/components/shared/UnsavedChangesBar";
import { PromotionDiscountCard } from "@/components/storefront/PromotionDiscountCard";
import { PromotionStatusCard } from "@/components/storefront/PromotionStatusCard";
import { PromotionTickerCard } from "@/components/storefront/PromotionTickerCard";
import { PromotionVisibilityCard } from "@/components/storefront/PromotionVisibilityCard";
import { PERMISSIONS } from "@/config/permissions";
import { useToast } from "@/context";
import { useMyAccess } from "@/hooks/useMyAccess";
import { DISCOUNTS_QUERY_KEY, getDiscounts } from "@/lib/api/discounts";
import { STOREFRONT_SETTINGS_QUERY_KEY, launchFlashSale, updateFlashSale } from "@/lib/api/storefront";
import { toFeaturedDiscount, toPromotedSale } from "@/lib/storefront/salePricing";
import { flashSaleFormSchema, type FlashSaleFormValues } from "@/lib/validation/storefront";
import type { Category } from "@/types/product";
import type { FeaturedDiscount } from "@/types/discount";
import type { FlashSale, FlashSalePreset, PromotedSale } from "@/types/storefront";

const DAY_MS = 86_400_000;
const FORM_ID = "promotion-form";

function toFormValues(sale: FlashSale): FlashSaleFormValues {
  const { active: _active, ...values } = sale;
  return values;
}

interface FlashSalePanelProps {
  sale: FlashSale;
  featuredDiscount: FeaturedDiscount | null;
  categories: Category[];
  canEdit: boolean;
  // Live preview of what shoppers would see, including unsaved picks.
  onPreviewChange: (sale: PromotedSale | null) => void;
}

// On/off saves instantly, everything else saves together from the bar.
export function FlashSalePanel({ sale, featuredDiscount, categories, canEdit, onPreviewChange }: FlashSalePanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can } = useMyAccess();
  const { data: discountsRes } = useQuery({ queryKey: DISCOUNTS_QUERY_KEY, queryFn: getDiscounts, enabled: can(PERMISSIONS.discounts.view) });
  const discounts = useMemo(() => discountsRes?.data ?? [], [discountsRes]);

  const formValues = useMemo(() => toFormValues(sale), [sale]);
  const form = useForm<FlashSaleFormValues>({ resolver: zodResolver(flashSaleFormSchema), defaultValues: formValues });
  const { control, handleSubmit, reset, formState: { isDirty } } = form;
  const draft = useWatch({ control }) as FlashSaleFormValues;

  useEffect(() => reset(formValues), [formValues, reset]);

  // The saved featured discount carries server-expanded categories, reuse it.
  const selected = useMemo(() => {
    if (!draft.discount_id) return null;
    if (featuredDiscount?._id === draft.discount_id) return featuredDiscount;
    const listed = discounts.find((d) => d._id === draft.discount_id);
    return listed ? toFeaturedDiscount(listed, categories) : null;
  }, [draft.discount_id, featuredDiscount, discounts, categories]);

  const preview = useMemo(() => toPromotedSale({ ...draft, active: sale.active }, selected), [draft, sale.active, selected]);
  useEffect(() => onPreviewChange(preview), [preview, onPreviewChange]);

  const onSaved = (res: Awaited<ReturnType<typeof updateFlashSale>>) => {
    queryClient.setQueryData(STOREFRONT_SETTINGS_QUERY_KEY, res);
    void queryClient.invalidateQueries({ queryKey: DISCOUNTS_QUERY_KEY });
  };
  const onError = (err: Error) => toast({ title: "Couldn't update the promotion", description: err.message, tone: "danger" });

  const saveMutation = useMutation({ mutationFn: updateFlashSale, onSuccess: onSaved, onError });
  const toggleMutation = useMutation({
    mutationFn: (active: boolean) => updateFlashSale({ active }),
    onSuccess: (res, active) => {
      onSaved(res);
      toast({ title: active ? "Promotion is on" : "Promotion paused", tone: active ? "success" : "default" });
    },
    onError,
  });
  const launchMutation = useMutation({ mutationFn: launchFlashSale, onSuccess: onSaved, onError });

  function launchPreset(preset: FlashSalePreset, categoryIds: string[]) {
    const ends_at = new Date(Date.now() + preset.durationDays * DAY_MS).toISOString();
    launchMutation.mutate(
      { ...preset.sale, category_ids: categoryIds, ends_at },
      { onSuccess: () => toast({ title: `${preset.label} launched`, tone: "success" }) },
    );
  }

  const busy = saveMutation.isPending || toggleMutation.isPending || launchMutation.isPending;
  const live = !!toPromotedSale(sale, featuredDiscount);

  return (
    <div className="space-y-4">
      <PromotionStatusCard
        discount={featuredDiscount}
        active={sale.active}
        live={live}
        canToggle={canEdit && !busy && (sale.active || !!sale.discount_id)}
        toggling={toggleMutation.isPending}
        onToggle={(active) => toggleMutation.mutate(active)}
      />

      <FormProvider {...form}>
        <form
          id={FORM_ID}
          onSubmit={handleSubmit((values) => saveMutation.mutate(values, { onSuccess: () => toast({ title: "Promotion saved", tone: "success" }) }))}
        >
          {/* Fieldsets default to min-content, the ticker would widen the page. */}
          <fieldset disabled={!canEdit} className="min-w-0 space-y-4">
            <div className="grid items-start gap-4 *:min-w-0 xl:grid-cols-2">
              <PromotionDiscountCard
                discounts={discounts}
                selected={selected}
                categories={categories}
                canEdit={canEdit}
                canLaunch={canEdit && can(PERMISSIONS.discounts.create)}
                busy={busy}
                onLaunch={launchPreset}
              />
              <PromotionVisibilityCard canEdit={canEdit} />
            </div>
            <PromotionTickerCard preview={preview} canEdit={canEdit} />
          </fieldset>
        </form>
      </FormProvider>

      <UnsavedChangesBar visible={canEdit && isDirty} saving={saveMutation.isPending} formId={FORM_ID} onDiscard={() => reset(formValues)} />
    </div>
  );
}
