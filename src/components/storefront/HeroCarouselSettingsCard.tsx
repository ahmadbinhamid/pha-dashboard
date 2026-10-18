import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { FieldDensityProvider } from "@/components/ui/FieldDensity";
import { FormField } from "@/components/ui/FormField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Slider } from "@/components/ui/Slider";
import { Switch } from "@/components/ui/Switch";
import { HERO_AUTOPLAY_SECONDS, HERO_HEIGHT_OPTIONS } from "@/config/storefront";
import { useToast } from "@/context";
import { STOREFRONT_SETTINGS_QUERY_KEY, updateHeroSettings } from "@/lib/api/storefront";
import { heroSettingsFormSchema, type HeroSettingsFormValues } from "@/lib/validation/storefront";
import type { HeroSettings } from "@/types/storefront";

interface HeroCarouselSettingsCardProps {
  settings: HeroSettings;
  canEdit: boolean;
  // Live values for the preview, null once saved or reset.
  onDraftChange: (draft: HeroSettings | null) => void;
}

/** Carousel-wide behaviour: autoplay, speed, controls and height. */
export function HeroCarouselSettingsCard({ settings, canEdit, onDraftChange }: HeroCarouselSettingsCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { control, handleSubmit, reset, formState: { isDirty } } = useForm<HeroSettingsFormValues>({
    resolver: zodResolver(heroSettingsFormSchema),
    defaultValues: settings,
  });
  const draft = useWatch({ control }) as HeroSettingsFormValues;

  useEffect(() => reset(settings), [settings, reset]);
  useEffect(() => onDraftChange(isDirty ? draft : null), [draft, isDirty, onDraftChange]);

  const mutation = useMutation({
    mutationFn: updateHeroSettings,
    onSuccess: (res) => {
      queryClient.setQueryData(STOREFRONT_SETTINGS_QUERY_KEY, res);
      toast({ title: "Carousel settings saved", tone: "success" });
    },
    onError: (err: Error) => toast({ title: "Couldn't save carousel settings", description: err.message, tone: "danger" }),
  });

  const toggle = (name: "autoplay" | "show_arrows" | "show_dots", label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit} label={label} />}
    />
  );
  const summary = `${draft.autoplay ? `Autoplay every ${draft.interval_seconds}s` : "Manual"} · ${draft.height}`;

  return (
    <Disclosure title="Carousel settings" summary={summary}>
      <form className="space-y-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <fieldset disabled={!canEdit} className="min-w-0 space-y-4">
          <FieldDensityProvider density="compact">
            <div className="grid gap-2 sm:grid-cols-3">
              {toggle("autoplay", "Autoplay")}
              {toggle("show_arrows", "Arrows")}
              {toggle("show_dots", "Progress dots")}
            </div>
          </FieldDensityProvider>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Time per slide">
              <Controller
                control={control}
                name="interval_seconds"
                render={({ field }) => (
                  <Slider
                    value={field.value}
                    onChange={field.onChange}
                    min={HERO_AUTOPLAY_SECONDS.min}
                    max={HERO_AUTOPLAY_SECONDS.max}
                    disabled={!canEdit || !draft.autoplay}
                    ariaLabel="Seconds per slide"
                    formatValue={(v) => `${v}s`}
                  />
                )}
              />
            </FormField>
            <FormField label="Height">
              <Controller
                control={control}
                name="height"
                render={({ field }) => <SegmentedControl options={HERO_HEIGHT_OPTIONS} value={field.value} onChange={field.onChange} ariaLabel="Height" fullWidth />}
              />
            </FormField>
          </div>
        </fieldset>
        {canEdit ? (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={!isDirty} onClick={() => reset(settings)}>
              Discard
            </Button>
            <Button type="submit" size="sm" disabled={!isDirty || mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save settings"}
            </Button>
          </div>
        ) : null}
      </form>
    </Disclosure>
  );
}
