import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageUploadButton } from "@/components/media/ImageUploadButton";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { FormSubsection } from "@/components/shared/FormSubsection";
import { SaveStatusText } from "@/components/shared/SaveStatusText";
import { SignupOfferFields } from "@/components/storefront/SignupOfferFields";
import { SignupPopupPreview } from "@/components/storefront/SignupPopupPreview";
import { BANNER_PLACEMENT_OPTIONS, HERO_IMAGE_MAX_BYTES, POPUP_DELAY_SECONDS, POPUP_FREQUENCY_DAYS } from "@/config/storefront";
import { useToast } from "@/context";
import { STOREFRONT_SETTINGS_QUERY_KEY, updateSignupPopup } from "@/lib/api/storefront";
import { saleHeadline } from "@/lib/storefront/salePricing";
import { signupPopupFormSchema, type SignupPopupFormValues } from "@/lib/validation/storefront";
import type { SignupPopup } from "@/types/storefront";

interface SignupPopupPanelProps {
  popup: SignupPopup;
  canEdit: boolean;
}

export function SignupPopupPanel({ popup, canEdit }: SignupPopupPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, reset, setValue, formState: { errors, isDirty } } = useForm<SignupPopupFormValues>({
    resolver: zodResolver(signupPopupFormSchema),
    defaultValues: popup,
  });
  const draft = useWatch({ control }) as SignupPopupFormValues;

  useEffect(() => reset(popup), [popup, reset]);

  const mutation = useMutation({
    // Counts are read-only stats, the server owns them.
    mutationFn: ({ offer: { issued_count: _i, redeemed_count: _r, ...offer }, ...rest }: SignupPopupFormValues) =>
      updateSignupPopup({ ...rest, offer }),
    onSuccess: (res) => {
      queryClient.setQueryData(STOREFRONT_SETTINGS_QUERY_KEY, res);
      toast({ title: "Signup popup saved", tone: "success" });
    },
  });

  const dateField = (name: "starts_at" | "ends_at", placeholder: string, defaultTime: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <DateTimePicker value={field.value} onChange={field.onChange} disabled={!canEdit} placeholder={placeholder} defaultTime={defaultTime} />
      )}
    />
  );

  return (
    <Card>
      <CardHeader
        title="Signup popup"
        description="Opens after a shopper has browsed for a few seconds, inviting them to join your newsletter."
      />
      <CardContent>
        <div className="mb-5 space-y-1.5">
          <p className="text-xs font-medium text-fg/55">Live preview</p>
          <SignupPopupPreview
            popup={draft}
            offerLabel={draft.offer?.enabled ? saleHeadline(draft.offer) : null}
            className={draft.enabled ? undefined : "opacity-50"}
          />
        </div>

        <form className="space-y-6" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <fieldset disabled={!canEdit} className="min-w-0 space-y-6">
            <Controller
              control={control}
              name="enabled"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={!canEdit}
                  label="Show the popup"
                  description="Turn off to hide it without losing your settings."
                />
              )}
            />

            <FormSubsection title="Content">
              <FormField label="Headline" error={errors.headline?.message}>
                <Input {...register("headline")} maxLength={80} placeholder="Sign up and get 10% off" />
              </FormField>
              <FormField label="Message" error={errors.body?.message}>
                <Textarea {...register("body")} maxLength={300} size="sm" placeholder="Join our newsletter for deals and new arrivals." />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Button text" error={errors.button_label?.message}>
                  <Input {...register("button_label")} maxLength={30} />
                </FormField>
                <FormField label="After signing up" hint="Shown with the code, if there is one" error={errors.success_message?.message}>
                  <Input {...register("success_message")} maxLength={160} />
                </FormField>
              </div>
              <FormField label="Image" hint="Optional banner across the top" error={errors.image_url?.message}>
                <div className="flex gap-2">
                  <Input {...register("image_url")} placeholder="https://…" />
                  <ImageUploadButton
                    maxBytes={HERO_IMAGE_MAX_BYTES}
                    className="shrink-0"
                    disabled={!canEdit}
                    onUploaded={(url) => setValue("image_url", url, { shouldDirty: true, shouldValidate: true })}
                  />
                </div>
              </FormField>
              <Controller
                control={control}
                name="collect_first_name"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={!canEdit}
                    label="Ask for their first name"
                    description="Lets campaigns greet them by name."
                  />
                )}
              />
            </FormSubsection>

            <FormSubsection title="Offer">
              <SignupOfferFields control={control} register={register} errors={errors} offer={draft.offer} saved={popup.offer} canEdit={canEdit} />
              <FormField label="Add signups to list" hint="Target this list from a campaign later" error={errors.list_name?.message}>
                <Input {...register("list_name")} maxLength={60} placeholder="Website popup" />
              </FormField>
            </FormSubsection>

            <FormSubsection title="Where & when">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Open after (seconds)" error={errors.delay_seconds?.message}>
                  <Input
                    type="number"
                    min={POPUP_DELAY_SECONDS.min}
                    max={POPUP_DELAY_SECONDS.max}
                    {...register("delay_seconds", { valueAsNumber: true })}
                  />
                </FormField>
                <FormField label="Show again after (days)" hint="Once closed or signed up" error={errors.frequency_days?.message}>
                  <Input
                    type="number"
                    min={POPUP_FREQUENCY_DAYS.min}
                    max={POPUP_FREQUENCY_DAYS.max}
                    {...register("frequency_days", { valueAsNumber: true })}
                  />
                </FormField>
              </div>
              <FormField label="Show on" hint="Never shown on the cart or checkout">
                <Controller
                  control={control}
                  name="placement"
                  render={({ field }) => (
                    <SegmentedControl options={BANNER_PLACEMENT_OPTIONS} value={field.value} onChange={field.onChange} ariaLabel="Show on" />
                  )}
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Starts">{dateField("starts_at", "Straight away", "00:00")}</FormField>
                <FormField label="Ends" error={errors.ends_at?.message}>
                  {dateField("ends_at", "No end date", "23:59")}
                </FormField>
              </div>
            </FormSubsection>
          </fieldset>

          {canEdit ? (
            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              {isDirty ? <span className="text-xs text-fg/55">Unsaved changes</span> : null}
              <SaveStatusText isSuccess={false} error={mutation.isError ? mutation.error.message : null} />
              <Button type="button" variant="secondary" size="sm" disabled={!isDirty} onClick={() => reset(popup)}>
                Discard
              </Button>
              <Button type="submit" size="sm" disabled={!isDirty || mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save popup"}
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
