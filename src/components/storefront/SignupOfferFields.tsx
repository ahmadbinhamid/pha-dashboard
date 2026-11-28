import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { FormField } from "@/components/ui/FormField";
import { InlineNotice } from "@/components/ui/InlineNotice";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { DISCOUNT_TYPE_OPTIONS } from "@/config/discounts";
import { pluralize } from "@/utils/format";
import type { SignupPopupFormValues } from "@/lib/validation/storefront";
import type { SignupOffer } from "@/types/storefront";

interface SignupOfferFieldsProps {
  control: Control<SignupPopupFormValues>;
  register: UseFormRegister<SignupPopupFormValues>;
  errors: FieldErrors<SignupPopupFormValues>;
  offer: SignupOffer;
  // Saved counts, which the form never edits.
  saved: SignupOffer;
  canEdit: boolean;
}

const EXAMPLE_SUFFIX = "7KQ2MX";

const nullableDays = (v: unknown) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));

export function SignupOfferFields({ control, register, errors, offer, saved, canEdit }: SignupOfferFieldsProps) {
  const e = errors.offer;
  return (
    <div className="space-y-4">
      <Controller
        control={control}
        name="offer.enabled"
        render={({ field }) => (
          <Switch
            checked={field.value}
            onCheckedChange={field.onChange}
            disabled={!canEdit}
            label="Give a discount for signing up"
            description="Off: the popup just collects newsletter signups."
          />
        )}
      />

      {offer.enabled ? (
        <>
          <InlineNotice variant="ok">
            Every signup gets their own code, e.g. {offer.code_prefix || "WELCOME"}-{EXAMPLE_SUFFIX}. It works once, and only at checkout with the email
            they signed up with.
          </InlineNotice>
          <Controller
            control={control}
            name="offer.discount_type"
            render={({ field }) => (
              <SegmentedControl options={DISCOUNT_TYPE_OPTIONS} value={field.value} onChange={field.onChange} ariaLabel="Discount type" fullWidth />
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {offer.discount_type !== "free_shipping" ? (
              <FormField
                label={offer.discount_type === "percent" ? "Percent off" : "Dollars off the order"}
                error={e?.discount_value?.message}
              >
                <Input
                  type="number"
                  min={0}
                  step={offer.discount_type === "percent" ? 1 : 0.01}
                  {...register("offer.discount_value", { valueAsNumber: true })}
                />
              </FormField>
            ) : null}
            <FormField label="Minimum order ($)" hint="0 for no minimum" error={e?.minimum_order?.message}>
              <Input type="number" min={0} step={0.01} {...register("offer.minimum_order", { valueAsNumber: true })} />
            </FormField>
            <FormField label="Code starts with" hint="Letters and numbers" error={e?.code_prefix?.message}>
              <Input
                {...register("offer.code_prefix", { setValueAs: (v: string) => v.toUpperCase() })}
                maxLength={10}
                className="font-mono uppercase"
                placeholder="WELCOME"
              />
            </FormField>
            <FormField label="Each code expires after (days)" hint="Leave blank to never expire" error={e?.code_valid_days?.message}>
              <Input type="number" min={1} max={365} {...register("offer.code_valid_days", { setValueAs: nullableDays })} />
            </FormField>
          </div>
          {saved.issued_count ? (
            <p className="text-xs text-fg/55">
              {pluralize(saved.issued_count, "code")} handed out so far, {saved.redeemed_count} used. Changes here also apply to codes already
              handed out.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
