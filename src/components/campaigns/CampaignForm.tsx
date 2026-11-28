import { useEffect, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { UnsavedChangesBar } from "@/components/shared/UnsavedChangesBar";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { CampaignAudienceCard } from "@/components/campaigns/CampaignAudienceCard";
import { EmailBuilder } from "@/components/campaigns/EmailBuilder";
import {
  CAMPAIGN_KIND_OPTIONS,
  FREQUENCY_OPTIONS,
  MERGE_TAGS,
  MONTH_DAY_OPTIONS,
  TIMEZONE_OPTIONS,
  WEEKDAY_OPTIONS,
} from "@/config/campaigns";
import { campaignToFormValues } from "@/lib/campaigns/campaignForm";
import { campaignFormSchema, type CampaignFormValues } from "@/lib/validation/campaign";
import { pluralize } from "@/utils/format";
import type { CampaignDetail } from "@/types/campaign";

interface CampaignFormProps {
  // Null creates a new campaign.
  campaign: CampaignDetail | null;
  canEdit: boolean;
  saving: boolean;
  onSubmit: (values: CampaignFormValues) => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  // Shown beside the setup fields: the send card and send history.
  aside?: ReactNode;
  footer?: ReactNode;
}

type FormTab = "setup" | "design";

const FORM_ID = "campaign-form";

// Keeps a saved non-Australian zone selectable instead of blanking it.
const timezoneOptions = (current: string) =>
  TIMEZONE_OPTIONS.some((o) => o.value === current) ? TIMEZONE_OPTIONS : [...TIMEZONE_OPTIONS, { value: current, label: current }];

const MERGE_TAG_HINT = `Personalise with ${MERGE_TAGS.map((m) => m.tag).join(", ")}`;

export function CampaignForm({ campaign, canEdit, saving, onSubmit, onCancel, onDirtyChange, aside, footer }: CampaignFormProps) {
  const [tab, setTab] = useState<FormTab>("setup");
  const { register, control, handleSubmit, reset, setValue, formState: { errors, isDirty } } = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: campaignToFormValues(campaign),
  });
  const values = useWatch({ control }) as CampaignFormValues;

  useEffect(() => reset(campaignToFormValues(campaign)), [campaign, reset]);
  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);

  const recurring = values.kind === "recurring";
  // A live schedule can't flip type mid-flight; the server enforces it too.
  const kindLocked = !!campaign && !["draft", "paused"].includes(campaign.status);
  const blockCount = values.design?.blocks.length ?? 0;
  const audienceError = errors.audience_lists?.message ?? errors.audience_contact_ids?.message;
  const dirty = { shouldDirty: true, shouldValidate: true } as const;

  // Errors on the other tab would otherwise be invisible.
  const onInvalid = () => setTab("setup");

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as FormTab)}>
        <TabsList>
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="design">Design {blockCount ? `(${pluralize(blockCount, "block")})` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" forceMount className="data-[state=inactive]:hidden">
          <div className="grid items-start gap-6 lg:grid-cols-3">
            <fieldset disabled={!canEdit} className="min-w-0 space-y-4 lg:col-span-2">
              <Card>
                <CardHeader title="Campaign" description="Only your team sees the name." />
                <CardContent className="space-y-5">
                  <FormField label="Name" required error={errors.name?.message}>
                    <Input {...register("name")} placeholder="Spring brake sale" />
                  </FormField>
                  <FormField label="Type" hint={kindLocked ? "Pause the campaign to change its type" : undefined}>
                    <Controller
                      control={control}
                      name="kind"
                      render={({ field }) => (
                        <SegmentedControl
                          options={CAMPAIGN_KIND_OPTIONS.map((o) => ({ ...o, disabled: kindLocked }))}
                          value={field.value}
                          onChange={field.onChange}
                          ariaLabel="Campaign type"
                        />
                      )}
                    />
                  </FormField>
                </CardContent>
              </Card>

              <Card>
                <CardHeader title="Inbox" description={MERGE_TAG_HINT} />
                <CardContent className="space-y-5">
                  <FormField label="Subject line" error={errors.subject?.message}>
                    <Input {...register("subject")} placeholder="Hi {{first_name}}, 20% off brakes this week" />
                  </FormField>
                  <FormField label="Preview text" hint="Shown after the subject in most inboxes" error={errors.preheader?.message}>
                    <Input {...register("preheader")} placeholder="Ends Sunday. Free shipping over $99." />
                  </FormField>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border p-3">
                    <span className="text-sm text-fg/70">
                      {blockCount ? `Email design: ${pluralize(blockCount, "block")}` : "No email design yet"}
                    </span>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setTab("design")}>
                      {blockCount ? "Edit design" : "Design the email"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <CampaignAudienceCard
                audience={{ type: values.audience_type, lists: values.audience_lists, contact_ids: values.audience_contact_ids }}
                onChange={(a) => {
                  setValue("audience_type", a.type, dirty);
                  setValue("audience_lists", a.lists, dirty);
                  setValue("audience_contact_ids", a.contact_ids, dirty);
                }}
                knownContacts={campaign?.audience_contacts ?? []}
                canEdit={canEdit}
                error={audienceError}
              />

              {recurring ? (
                <Card>
                  <CardHeader title="Schedule" description="Sends automatically once you start the newsletter" />
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Repeats">
                      <Controller
                        control={control}
                        name="frequency"
                        render={({ field }) => <SingleSelect options={FREQUENCY_OPTIONS} value={field.value} onChange={field.onChange} disabled={!canEdit} />}
                      />
                    </FormField>
                    {values.frequency === "monthly" ? (
                      <FormField label="Day of month">
                        <Controller
                          control={control}
                          name="day_of_month"
                          render={({ field }) => <SingleSelect options={MONTH_DAY_OPTIONS} value={field.value} onChange={field.onChange} disabled={!canEdit} />}
                        />
                      </FormField>
                    ) : (
                      <FormField label="Day">
                        <Controller
                          control={control}
                          name="day_of_week"
                          render={({ field }) => <SingleSelect options={WEEKDAY_OPTIONS} value={field.value} onChange={field.onChange} disabled={!canEdit} />}
                        />
                      </FormField>
                    )}
                    <FormField label="Time" error={errors.time?.message}>
                      <Input type="time" {...register("time")} />
                    </FormField>
                    <FormField label="Time zone">
                      <Controller
                        control={control}
                        name="timezone"
                        render={({ field }) => (
                          <SingleSelect options={timezoneOptions(field.value)} value={field.value} onChange={field.onChange} disabled={!canEdit} />
                        )}
                      />
                    </FormField>
                  </CardContent>
                </Card>
              ) : null}
            </fieldset>
            {aside ? <div className="space-y-4 lg:sticky lg:top-4">{aside}</div> : null}
          </div>
          {footer ? <div className="mt-4">{footer}</div> : null}
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
                subject={values.subject}
                preheader={values.preheader}
                templateName={values.name || "My template"}
              />
            )}
          />
        </TabsContent>
      </Tabs>

      {canEdit ? (
        <UnsavedChangesBar
          visible={!campaign || isDirty}
          saving={saving}
          formId={FORM_ID}
          saveLabel={campaign ? "Save changes" : "Create campaign"}
          onDiscard={() => (campaign ? reset(campaignToFormValues(campaign)) : onCancel())}
        />
      ) : null}
    </form>
  );
}
