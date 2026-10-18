import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Disclosure } from "@/components/ui/Disclosure";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { DiscountMethodPicker } from "@/components/discounts/DiscountMethodPicker";
import { DiscountSummaryCard } from "@/components/discounts/DiscountSummaryCard";
import {
  DISCOUNT_SCOPE_OPTIONS,
  DISCOUNT_TYPE_OPTIONS,
  GENERATED_CODE_LENGTH,
  MAX_ORDER_NUMBER,
  ORDER_RULE_OPTIONS,
} from "@/config/discounts";
import { discountConditions, discountOrderLabel, discountSchedule } from "@/lib/discounts/discountDisplay";
import { discountToFormValues, generatePromoCode, orderRangeFromForm } from "@/lib/discounts/discountForm";
import { discountFormSchema, type DiscountFormValues } from "@/lib/validation/discount";
import type { Category } from "@/types/product";
import type { Discount } from "@/types/discount";

interface DiscountFormProps {
  // Null creates a new discount.
  discount: Discount | null;
  // Pre-fills a new discount, e.g. a template, pass a stable value.
  initialValues?: DiscountFormValues;
  categories: Category[];
  canEdit: boolean;
  saving: boolean;
  onSubmit: (values: DiscountFormValues) => void;
  onCancel: () => void;
}

const nullableNumber = (v: unknown) => (v === "" || v == null ? null : Number(v));

export function DiscountForm({ discount, initialValues, categories, canEdit, saving, onSubmit, onCancel }: DiscountFormProps) {
  const { register, control, handleSubmit, reset, setValue, formState: { errors, isDirty } } = useForm<DiscountFormValues>({
    resolver: zodResolver(discountFormSchema),
    defaultValues: initialValues ?? discountToFormValues(discount),
  });
  const values = useWatch({ control }) as DiscountFormValues;

  useEffect(() => reset(initialValues ?? discountToFormValues(discount)), [discount, initialValues, reset]);

  const isCode = values.method === "code";
  const range = orderRangeFromForm(values);
  const orderSummary = discountOrderLabel({ min_order_number: range.min, max_order_number: range.max });
  const limitSummary = [
    values.limit_usage && values.usage_limit ? `${values.usage_limit} uses` : "Unlimited",
    isCode || values.once_per_customer ? "1 per email" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const categoryOptions = categories.map((c) => ({ value: c._id, label: c.name }));

  const dateField = (name: "starts_at" | "ends_at") => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <DateTimePicker
          value={field.value}
          onChange={field.onChange}
          disabled={!canEdit}
          placeholder={name === "starts_at" ? "Starts now" : "No end date"}
          defaultTime={name === "starts_at" ? "00:00" : "23:59"}
        />
      )}
    />
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid items-start gap-6 lg:grid-cols-3">
      <fieldset disabled={!canEdit} className="min-w-0 space-y-4 lg:col-span-2">
        <Card>
          <CardHeader title="Basics" description="Name it, choose how shoppers get it, and set the saving." />
          <CardContent className="space-y-5">
            <FormField label="Name" required hint="Shown in the cart and on orders" error={errors.name?.message}>
              <Input {...register("name")} placeholder="Spring brake sale" />
            </FormField>
            <Controller
              control={control}
              name="method"
              render={({ field }) => <DiscountMethodPicker value={field.value} onChange={field.onChange} disabled={!canEdit} />}
            />
            {isCode ? (
              <FormField label="Promo code" required hint="Letters, numbers, . - or _ · each email can use it once" error={errors.code?.message}>
                <div className="flex gap-2 sm:w-96">
                  <Input {...register("code", { setValueAs: (v: string) => v.toUpperCase() })} className="font-mono uppercase" placeholder="SAVE20" />
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => setValue("code", generatePromoCode(GENERATED_CODE_LENGTH), { shouldDirty: true, shouldValidate: true })}
                  >
                    Generate
                  </Button>
                </div>
              </FormField>
            ) : null}
            <div className="space-y-3 border-t border-border pt-5">
              <Controller
                control={control}
                name="discount_type"
                render={({ field }) => (
                  <SegmentedControl options={DISCOUNT_TYPE_OPTIONS} value={field.value} onChange={field.onChange} ariaLabel="Discount type" fullWidth />
                )}
              />
              {values.discount_type !== "free_shipping" ? (
                <FormField
                  label={values.discount_type === "percent" ? "Percent off" : "Dollars off the order"}
                  hint={values.discount_type === "percent" ? "1-90% off eligible items" : "Split across eligible items"}
                  error={errors.discount_value?.message}
                  className="sm:w-60"
                >
                  <Input type="number" min={0} step={values.discount_type === "percent" ? 1 : 0.01} {...register("discount_value", { valueAsNumber: true })} />
                </FormField>
              ) : (
                <p className="text-xs text-fg/55">Waives shipping when every item in the cart is eligible.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Disclosure title="Which orders" summary={orderSummary} defaultOpen={values.order_rule !== "any"}>
          <p className="text-xs text-fg/55">
            Counts the shopper&apos;s paid website orders by checkout email. Cancelled or fully refunded orders don&apos;t count.
          </p>
          <Controller
            control={control}
            name="order_rule"
            render={({ field }) => <SegmentedControl options={ORDER_RULE_OPTIONS} value={field.value} onChange={field.onChange} ariaLabel="Which orders" />}
          />
          {values.order_rule === "custom" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="From order #" hint="Blank = their first order" error={errors.order_min?.message}>
                <Input type="number" min={1} max={MAX_ORDER_NUMBER} step={1} {...register("order_min", { setValueAs: nullableNumber })} placeholder="1" />
              </FormField>
              <FormField label="Up to order #" hint="Blank = no limit" error={errors.order_max?.message}>
                <Input type="number" min={1} max={MAX_ORDER_NUMBER} step={1} {...register("order_max", { setValueAs: nullableNumber })} placeholder="No limit" />
              </FormField>
            </div>
          ) : null}
        </Disclosure>

        <Disclosure title="Conditions" summary={discountConditions(values)} defaultOpen={values.minimum_order > 0 || values.scope !== "storewide"}>
          <FormField label="Minimum order ($)" hint="Cart subtotal needed; 0 for none" error={errors.minimum_order?.message} className="sm:w-60">
            <Input type="number" min={0} step={0.01} {...register("minimum_order", { valueAsNumber: true })} />
          </FormField>
          <FormField label="Applies to" error={errors.category_ids?.message}>
            <div className="space-y-2">
              <Controller
                control={control}
                name="scope"
                render={({ field }) => <SegmentedControl options={DISCOUNT_SCOPE_OPTIONS} value={field.value} onChange={field.onChange} ariaLabel="Applies to" />}
              />
              {values.scope === "categories" ? (
                <Controller
                  control={control}
                  name="category_ids"
                  render={({ field }) => (
                    <MultiSelect
                      options={categoryOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Pick categories (sub-categories included)"
                      searchPlaceholder="Search categories…"
                      disabled={!canEdit}
                    />
                  )}
                />
              ) : null}
            </div>
          </FormField>
        </Disclosure>

        <Disclosure title="Limits" summary={limitSummary} defaultOpen={values.limit_usage}>
          <Controller
            control={control}
            name="limit_usage"
            render={({ field }) => (
              <Checkbox
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                label="Limit the total number of uses"
                description="Stops once the limit is reached. Cancelled orders give their use back."
              />
            )}
          />
          {values.limit_usage ? (
            <FormField label="Total uses" error={errors.usage_limit?.message} className="sm:w-40">
              <Input type="number" min={1} step={1} {...register("usage_limit", { setValueAs: nullableNumber })} />
            </FormField>
          ) : null}
          {isCode ? (
            <p className="text-xs text-fg/55">Promo codes can be used once per email address.</p>
          ) : (
            <Controller
              control={control}
              name="once_per_customer"
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  label="One use per customer"
                  description="Matched by the email entered at checkout."
                />
              )}
            />
          )}
        </Disclosure>

        <Disclosure title="Schedule" summary={discountSchedule(values)} defaultOpen={!!(values.starts_at || values.ends_at)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Starts">{dateField("starts_at")}</FormField>
            <FormField label="Ends" error={errors.ends_at?.message}>
              {dateField("ends_at")}
            </FormField>
          </div>
        </Disclosure>
      </fieldset>

      <div className="space-y-4 lg:sticky lg:top-4">
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit} label="Active" description="Paused discounts never apply." />
          )}
        />
        <DiscountSummaryCard
          values={values}
          actions={
            canEdit ? (
              <>
                <Button type="submit" disabled={saving || (!!discount && !isDirty)}>
                  {saving ? "Saving…" : discount ? "Save changes" : "Create discount"}
                </Button>
                <Button type="button" variant="secondary" onClick={onCancel}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button type="button" variant="secondary" onClick={onCancel}>
                Back
              </Button>
            )
          }
        />
      </div>
    </form>
  );
}
