import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { Slider } from "@/components/ui/Slider";
import { Switch } from "@/components/ui/Switch";
import { ImageUploadButton } from "@/components/media/ImageUploadButton";
import { FormSubsection } from "@/components/shared/FormSubsection";
import { HeroPhotoPresetPicker } from "@/components/storefront/HeroPhotoPresetPicker";
import { HeroSlideView } from "@/components/storefront/HeroSlideView";
import {
  EMPTY_HERO_SLIDE,
  HERO_ALIGN_OPTIONS,
  HERO_IMAGE_MAX_BYTES,
  HERO_IMAGE_FOCUS_OPTIONS,
  HERO_OVERLAY,
  HERO_TEXT_TONE_OPTIONS,
  HERO_VERTICAL_OPTIONS,
} from "@/config/storefront";
import { heroSlideFormSchema, type HeroSlideFormValues } from "@/lib/validation/storefront";
import type { HeroSlide } from "@/types/storefront";

interface HeroSlideFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // null creates a new slide.
  slide: HeroSlide | null;
  saving: boolean;
  onSubmit: (values: HeroSlideFormValues) => void;
}

function toFormValues(slide: HeroSlide | null): HeroSlideFormValues {
  const { _id, ...values } = { ...EMPTY_HERO_SLIDE, ...slide };
  return values;
}

export function HeroSlideFormModal({ open, onOpenChange, slide, saving, onSubmit }: HeroSlideFormModalProps) {
  const { register, control, handleSubmit, reset, setValue, formState: { errors } } = useForm<HeroSlideFormValues>({
    resolver: zodResolver(heroSlideFormSchema),
    defaultValues: toFormValues(slide),
  });
  const preview = useWatch({ control }) as HeroSlideFormValues;

  useEffect(() => {
    if (open) reset(toFormValues(slide));
  }, [open, slide, reset]);

  const segmented = <K extends "align" | "vertical" | "text_tone">(name: K, options: Parameters<typeof SegmentedControl>[0]["options"], label: string) => (
    <FormField label={label}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => <SegmentedControl options={options} value={field.value} onChange={field.onChange} ariaLabel={label} />}
      />
    </FormField>
  );
  const dateField = (name: "starts_at" | "ends_at", placeholder: string, defaultTime: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <DateTimePicker value={field.value} onChange={field.onChange} placeholder={placeholder} defaultTime={defaultTime} />}
    />
  );

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>
            <ModalTitle>{slide ? "Edit hero slide" : "New hero slide"}</ModalTitle>
            <ModalDescription>Rotates in the carousel at the top of your storefront home page.</ModalDescription>
          </ModalHeader>

          <div className="space-y-5">
            <HeroSlideView slide={{ ...EMPTY_HERO_SLIDE, ...preview }} className="h-48 rounded-xl sm:h-56" />

            <FormSubsection title="Photo" divided>
              <Controller
                control={control}
                name="image_url"
                render={({ field }) => (
                  <div className="space-y-2">
                    <HeroPhotoPresetPicker value={field.value} onChange={field.onChange} />
                    <Input value={field.value} onChange={field.onChange} placeholder="Or paste an image link (https://…)" />
                  </div>
                )}
              />
              {errors.image_url ? <p className="text-xs text-danger">{errors.image_url.message}</p> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Phone photo" hint="Optional portrait crop for phones" error={errors.mobile_image_url?.message}>
                  <div className="flex gap-2">
                    <Input {...register("mobile_image_url")} placeholder="https://…" />
                    <ImageUploadButton
                      maxBytes={HERO_IMAGE_MAX_BYTES}
                      className="shrink-0"
                      onUploaded={(url) => setValue("mobile_image_url", url, { shouldDirty: true, shouldValidate: true })}
                    />
                  </div>
                </FormField>
                <FormField label="Keep in frame" hint="Which part stays visible when cropped">
                  <Controller
                    control={control}
                    name="image_focus"
                    render={({ field }) => <SingleSelect options={HERO_IMAGE_FOCUS_OPTIONS} value={field.value} onChange={(v) => field.onChange(v)} />}
                  />
                </FormField>
              </div>
            </FormSubsection>

            <FormSubsection title="Text" divided>
              <FormField label="Title" required error={errors.title?.message}>
                <Input {...register("title")} placeholder="Stop harder. Drive further." />
              </FormField>
              <FormField label="Subtitle" error={errors.subtitle?.message}>
                <Input {...register("subtitle")} placeholder="Slotted rotors and ceramic pads, fitted to your vehicle." />
              </FormField>
              <FormField label="Promo badge" hint="e.g. TOP SELLER, SPRING UPGRADE" error={errors.badge?.message} className="sm:w-72">
                <Input {...register("badge")} placeholder="TOP SELLER" />
              </FormField>
            </FormSubsection>

            <FormSubsection title="Buttons" divided>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Main button" error={errors.cta_label?.message}>
                  <Input {...register("cta_label")} placeholder="Shop now" />
                </FormField>
                <FormField label="Main button link" error={errors.cta_url?.message}>
                  <Input {...register("cta_url")} placeholder="/category/brakes" />
                </FormField>
                <FormField label="Second button" hint="Optional, outlined" error={errors.secondary_cta_label?.message}>
                  <Input {...register("secondary_cta_label")} placeholder="Browse categories" />
                </FormField>
                <FormField label="Second button link" error={errors.secondary_cta_url?.message}>
                  <Input {...register("secondary_cta_url")} placeholder="/categories" />
                </FormField>
              </div>
            </FormSubsection>

            <FormSubsection title="Layout" divided>
              <div className="grid gap-4 sm:grid-cols-3">
                {segmented("align", HERO_ALIGN_OPTIONS, "Horizontal")}
                {segmented("vertical", HERO_VERTICAL_OPTIONS, "Vertical")}
                {segmented("text_tone", HERO_TEXT_TONE_OPTIONS, "Text colour")}
              </div>
              <FormField label={preview.text_tone === "dark" ? "Light wash" : "Dark overlay"} hint="Keeps the text readable over the photo">
                <Controller
                  control={control}
                  name="overlay"
                  render={({ field }) => (
                    <Slider value={field.value} onChange={field.onChange} min={HERO_OVERLAY.min} max={HERO_OVERLAY.max} ariaLabel="Overlay" formatValue={(v) => `${v}%`} />
                  )}
                />
              </FormField>
            </FormSubsection>

            <FormSubsection title="Schedule" divided>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Show from">{dateField("starts_at", "Straight away", "00:00")}</FormField>
                <FormField label="Hide after" error={errors.ends_at?.message}>
                  {dateField("ends_at", "Never", "23:59")}
                </FormField>
              </div>
              <Controller
                control={control}
                name="active"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} label="Show on storefront" description="Hidden slides stay saved but don't rotate." />
                )}
              />
            </FormSubsection>
          </div>

          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : slide ? "Save slide" : "Add slide"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
