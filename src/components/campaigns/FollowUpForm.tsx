import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { Switch } from "@/components/ui/Switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { UnsavedChangesBar } from "@/components/shared/UnsavedChangesBar";
import { EmailBuilder } from "@/components/campaigns/EmailBuilder";
import {
  ALERT_THRESHOLD_OPTIONS,
  DEFAULT_FOLLOW_UP_DESIGN,
  DEFAULT_FOLLOW_UP_SUBJECT,
  FOLLOW_UP_CHANNEL_OPTIONS,
  FOLLOW_UP_DAYS,
  FOLLOW_UP_MERGE_HINT,
} from "@/config/followups";
import { previewFollowUp } from "@/lib/api/followups";
import { cloneDesign, normalizeDesign } from "@/lib/campaigns/emailDesign";
import { followUpFormSchema, type FollowUpFormValues } from "@/lib/validation/followup";
import { pluralize } from "@/utils/format";
import type { FollowUp } from "@/types/followup";

interface FollowUpFormProps {
  // Null sets up a new follow-up.
  followUp: FollowUp | null;
  canEdit: boolean;
  saving: boolean;
  onSubmit: (values: FollowUpFormValues) => void;
  onCancel: () => void;
}

type FormTab = "setup" | "design";
const FORM_ID = "follow-up-form";

function toFormValues(f: FollowUp | null): FollowUpFormValues {
  return {
    name: f?.name ?? "Product feedback",
    shipped_delay_days: f?.shipped_delay_days ?? 7,
    handover_delay_days: f?.handover_delay_days ?? 5,
    channels: f?.channels ?? ["storefront", "manual"],
    subject: f?.subject ?? DEFAULT_FOLLOW_UP_SUBJECT,
    preheader: f?.preheader ?? "Rate your parts in a few seconds",
    design: f?.design ? normalizeDesign(f.design) : cloneDesign(DEFAULT_FOLLOW_UP_DESIGN),
    ask_for_rating: f?.ask_for_rating ?? true,
    alert_at_or_below: String(f?.alert_at_or_below ?? 2),
    alert_email: f?.alert_email ?? "",
  };
}

export function FollowUpForm({ followUp, canEdit, saving, onSubmit, onCancel }: FollowUpFormProps) {
  const [tab, setTab] = useState<FormTab>("setup");
  const { register, control, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FollowUpFormValues>({
    resolver: zodResolver(followUpFormSchema),
    defaultValues: toFormValues(followUp),
  });
  const v = useWatch({ control }) as FollowUpFormValues;

  useEffect(() => reset(toFormValues(followUp)), [followUp, reset]);

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(onSubmit, () => setTab("setup"))} className="space-y-4">
      <Tabs value={tab} onValueChange={(t) => setTab(t as FormTab)}>
        <TabsList>
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="design">Email design</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" forceMount className="data-[state=inactive]:hidden">
          <fieldset disabled={!canEdit} className="min-w-0 space-y-4 lg:max-w-3xl">
            <Card>
              <CardHeader title="Follow-up" description="Only your team sees the name." />
              <CardContent>
                <FormField label="Name" required error={errors.name?.message}>
                  <Input {...register("name")} />
                </FormField>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="When it's sent"
                description="Counted from when the order is marked shipped or completed. Couriers take a few days, so shipped orders wait longer."
              />
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Days after shipping" hint="Courier orders" error={errors.shipped_delay_days?.message}>
                    <Input type="number" min={FOLLOW_UP_DAYS.min} max={FOLLOW_UP_DAYS.max} {...register("shipped_delay_days", { valueAsNumber: true })} />
                  </FormField>
                  <FormField label="Days after handover" hint="Pickup and local delivery" error={errors.handover_delay_days?.message}>
                    <Input type="number" min={FOLLOW_UP_DAYS.min} max={FOLLOW_UP_DAYS.max} {...register("handover_delay_days", { valueAsNumber: true })} />
                  </FormField>
                </div>
                <FormField label="Orders from" error={errors.channels?.message} hint="eBay orders are never emailed: eBay doesn't allow it">
                  <Controller
                    control={control}
                    name="channels"
                    render={({ field }) => (
                      <div className="space-y-2">
                        {FOLLOW_UP_CHANNEL_OPTIONS.map((o) => (
                          <Checkbox
                            key={o.value}
                            label={o.label}
                            checked={field.value.includes(o.value)}
                            onChange={(e) =>
                              field.onChange(e.target.checked ? [...field.value, o.value] : field.value.filter((c) => c !== o.value))
                            }
                          />
                        ))}
                      </div>
                    )}
                  />
                </FormField>
                <p className="text-xs text-fg/55">
                  Example: an order shipped Monday gets this email {pluralize(v.shipped_delay_days || 0, "day")} later. Refunded and cancelled orders, and
                  anyone who unsubscribed, are skipped.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Inbox" description={FOLLOW_UP_MERGE_HINT} />
              <CardContent className="space-y-5">
                <FormField label="Subject line" required error={errors.subject?.message}>
                  <Input {...register("subject")} />
                </FormField>
                <FormField label="Preview text" hint="Shown after the subject in most inboxes">
                  <Input {...register("preheader")} />
                </FormField>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border p-3">
                  <span className="text-sm text-fg/70">{pluralize(v.design?.blocks.length ?? 0, "block")} in the email design</span>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setTab("design")}>
                    Edit design
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Ratings" />
              <CardContent className="space-y-5">
                <Controller
                  control={control}
                  name="ask_for_rating"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={!canEdit}
                      label="Ask them to rate each product"
                      description="Adds the products from their order with 1-5 stars under your message. Answers appear in the Feedback tab."
                    />
                  )}
                />
                {v.ask_for_rating ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Email me when someone rates" hint="So you can contact unhappy customers quickly">
                      <Controller
                        control={control}
                        name="alert_at_or_below"
                        render={({ field }) => (
                          <SingleSelect options={ALERT_THRESHOLD_OPTIONS} value={field.value} onChange={field.onChange} disabled={!canEdit} />
                        )}
                      />
                    </FormField>
                    <FormField label="Send alerts to" hint="Blank uses your store email" error={errors.alert_email?.message}>
                      <Input type="email" {...register("alert_email")} placeholder="manager@yourstore.com.au" />
                    </FormField>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </fieldset>
        </TabsContent>

        <TabsContent value="design" forceMount className="data-[state=inactive]:hidden">
          <Controller
            control={control}
            name="design"
            render={({ field }) => (
              <EmailBuilder
                value={field.value}
                onChange={field.onChange}
                disabled={!canEdit}
                subject={v.subject}
                preheader={v.preheader}
                templateName={v.name || "Follow-up"}
                preview={(payload) => previewFollowUp({ ...payload, ask_for_rating: v.ask_for_rating })}
              />
            )}
          />
          {v.ask_for_rating ? (
            <p className="mt-3 text-xs text-fg/55">The products and rating stars are added below your design automatically. Preview shows them.</p>
          ) : null}
        </TabsContent>
      </Tabs>

      {canEdit ? (
        <UnsavedChangesBar
          visible={!followUp || isDirty}
          saving={saving}
          formId={FORM_ID}
          saveLabel={followUp ? "Save changes" : "Create follow-up"}
          onDiscard={() => (followUp ? reset(toFormValues(followUp)) : onCancel())}
        />
      ) : null}
    </form>
  );
}
