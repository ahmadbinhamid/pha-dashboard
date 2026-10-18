import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ColorSwatchInput } from "@/components/ui/ColorSwatchInput";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { FormSubsection } from "@/components/shared/FormSubsection";
import { SaveStatusText } from "@/components/shared/SaveStatusText";
import { AnnouncementStrip } from "@/components/storefront/AnnouncementStrip";
import { ColorThemePicker } from "@/components/storefront/ColorThemePicker";
import { ANNOUNCEMENT_ICON_OPTIONS, ANNOUNCEMENT_THEMES, BANNER_PLACEMENT_OPTIONS } from "@/config/storefront";
import { useToast } from "@/context";
import { STOREFRONT_SETTINGS_QUERY_KEY, updateAnnouncement } from "@/lib/api/storefront";
import { announcementFormSchema, type AnnouncementFormValues } from "@/lib/validation/storefront";
import type { Announcement } from "@/types/storefront";

interface AnnouncementPanelProps {
  announcement: Announcement;
  canEdit: boolean;
  // Live form values for the simulator, null once saved or reset.
  onDraftChange: (draft: Announcement | null) => void;
}

export function AnnouncementPanel({ announcement, canEdit, onDraftChange }: AnnouncementPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, reset, formState: { errors, isDirty } } = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementFormSchema),
    defaultValues: announcement,
  });
  const draft = useWatch({ control }) as AnnouncementFormValues;

  useEffect(() => reset(announcement), [announcement, reset]);
  useEffect(() => onDraftChange(isDirty ? draft : null), [draft, isDirty, onDraftChange]);

  const mutation = useMutation({
    mutationFn: updateAnnouncement,
    onSuccess: (res) => {
      queryClient.setQueryData(STOREFRONT_SETTINGS_QUERY_KEY, res);
      toast({ title: "Banner saved", tone: "success" });
    },
  });

  const colorField = (name: "bg_color" | "text_color", label: string) => (
    <FormField label={label} error={errors[name]?.message}>
      <Controller control={control} name={name} render={({ field }) => <ColorSwatchInput value={field.value} onChange={field.onChange} />} />
    </FormField>
  );
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
      <CardHeader title="Welcome banner" description="A strip across the top of your storefront for news, deals and delivery info." />
      <CardContent>
        <div className="mb-5 space-y-1.5">
          <p className="text-xs font-medium text-fg/55">Live preview</p>
          <div className="overflow-hidden rounded-lg border border-border">
            <AnnouncementStrip announcement={draft} className={draft.enabled ? undefined : "opacity-50"} />
          </div>
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
                  label="Show the banner"
                  description="Turn off to hide it without losing your settings."
                />
              )}
            />

            <FormSubsection title="Content">
              <FormField label="Message" error={errors.message?.message}>
                <Input
                  {...register("message")}
                  maxLength={200}
                  placeholder="Free Express Delivery on orders over $150 · Same-Day Melbourne Dispatch before 2PM!"
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Link" hint="A /path or a full URL. Leave blank for no link" error={errors.link_url?.message}>
                  <Input {...register("link_url")} placeholder="/shipping" />
                </FormField>
                <FormField label="Button text" hint="Shown when there's a link" error={errors.link_label?.message}>
                  <Input {...register("link_label")} maxLength={30} placeholder="Shop now" />
                </FormField>
              </div>
              <FormField label="Icon">
                <Controller
                  control={control}
                  name="icon"
                  render={({ field }) => <SegmentedControl options={ANNOUNCEMENT_ICON_OPTIONS} value={field.value} onChange={field.onChange} ariaLabel="Icon" />}
                />
              </FormField>
            </FormSubsection>

            <FormSubsection title="Colours">
              <Controller
                control={control}
                name="theme"
                render={({ field }) => (
                  <ColorThemePicker
                    options={ANNOUNCEMENT_THEMES}
                    value={field.value}
                    onChange={field.onChange}
                    customColor={draft.bg_color}
                    ariaLabel="Banner colours"
                    disabled={!canEdit}
                  />
                )}
              />
              {draft.theme === "custom" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {colorField("bg_color", "Background")}
                  {colorField("text_color", "Text")}
                </div>
              ) : null}
            </FormSubsection>

            <FormSubsection title="Where & when">
              <FormField label="Show on">
                <Controller
                  control={control}
                  name="placement"
                  render={({ field }) => <SegmentedControl options={BANNER_PLACEMENT_OPTIONS} value={field.value} onChange={field.onChange} ariaLabel="Show on" />}
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Starts">{dateField("starts_at", "Straight away", "00:00")}</FormField>
                <FormField label="Ends" error={errors.ends_at?.message}>
                  {dateField("ends_at", "No end date", "23:59")}
                </FormField>
              </div>
              <Controller
                control={control}
                name="dismissible"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={!canEdit}
                    label="Let shoppers close it"
                    description="Adds an ×; it stays closed for the rest of their visit."
                  />
                )}
              />
            </FormSubsection>
          </fieldset>

          {canEdit ? (
            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              {isDirty ? <span className="text-xs text-fg/55">Unsaved changes</span> : null}
              <SaveStatusText isSuccess={false} error={mutation.isError ? mutation.error.message : null} />
              <Button type="button" variant="secondary" size="sm" disabled={!isDirty} onClick={() => reset(announcement)}>
                Discard
              </Button>
              <Button type="submit" size="sm" disabled={!isDirty || mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save banner"}
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
