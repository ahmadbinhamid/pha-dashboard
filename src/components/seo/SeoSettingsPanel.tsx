import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { SkeletonText } from "@/components/ui/Skeleton";
import { StringListField } from "@/components/ui/StringListField";
import { Textarea } from "@/components/ui/Textarea";
import { ImageUploadButton } from "@/components/media/ImageUploadButton";
import { UnsavedChangesBar } from "@/components/shared/UnsavedChangesBar";
import { MetaLengthCounter } from "@/components/seo/MetaLengthCounter";
import { META_LIMITS, PAGE_META_LABEL, SEO_IMAGE_MAX_BYTES } from "@/config/seo";
import { PERMISSIONS } from "@/config/permissions";
import { useToast } from "@/context";
import { useMyAccess } from "@/hooks/useMyAccess";
import { useSeoSettings } from "@/hooks/useSeoSettings";
import { SEO_QUERY_KEY, updateSeoSettings } from "@/lib/api/seo";
import { applyTitleTemplate } from "@/lib/seo/seoText";
import { seoSettingsFormSchema, type SeoSettingsFormValues } from "@/lib/validation/seo";
import type { PageMetaKey, SeoSettings } from "@/types/seo";

const FORM_ID = "seo-settings-form";
const PAGE_KEYS = Object.keys(PAGE_META_LABEL) as PageMetaKey[];

function toFormValues(s: SeoSettings): SeoSettingsFormValues {
  const { storefront_url: _url, updated_at: _at, ...rest } = s;
  return rest;
}

const cleanList = (values: string[]) => values.map((v) => v.trim()).filter(Boolean);

export function SeoSettingsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can } = useMyAccess();
  const canEdit = can(PERMISSIONS.seo.update);
  const { settings, isLoading } = useSeoSettings();
  const { register, control, handleSubmit, reset, setValue, formState: { errors, isDirty } } = useForm<SeoSettingsFormValues>({
    resolver: zodResolver(seoSettingsFormSchema),
  });
  const v = useWatch({ control }) as SeoSettingsFormValues;

  useEffect(() => {
    if (settings) reset(toFormValues(settings));
  }, [settings, reset]);

  const mutation = useMutation({
    mutationFn: (values: SeoSettingsFormValues) =>
      updateSeoSettings({
        ...values,
        social_profiles: cleanList(values.social_profiles),
        robots_disallow: cleanList(values.robots_disallow),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SEO_QUERY_KEY });
      toast({ title: "SEO settings saved", tone: "success" });
    },
    onError: (err: Error) => toast({ title: "Couldn't save the settings", description: err.message, tone: "danger" }),
  });

  if (isLoading || !settings || !v?.page_meta) return <SkeletonText lines={8} />;

  return (
    <form id={FORM_ID} onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
      <fieldset disabled={!canEdit} className="min-w-0 space-y-4">
        <Card>
          <CardHeader title="Search defaults" description="Used on every page that doesn't set its own." />
          <CardContent className="space-y-5">
            <FormField label="Site name" hint="Used in Google's structured data and social shares">
              <Input {...register("site_name")} />
            </FormField>
            <FormField
              label="Page title format"
              hint={`Example: "${applyTitleTemplate(v.title_template, "Brake pads")}"`}
              error={errors.title_template?.message}
            >
              <Input {...register("title_template")} placeholder="%s | Parts Hub Australia" />
            </FormField>
            <FormField
              label="Default description"
              aside={<MetaLengthCounter length={v.default_description?.length ?? 0} ideal={META_LIMITS.description} />}
            >
              <Textarea size="sm" {...register("default_description")} maxLength={META_LIMITS.descriptionMax} />
            </FormField>
            <FormField label="Default social share image" hint="Used when a page has no image of its own. 1200 × 630 works best.">
              <div className="space-y-2">
                {v.default_og_image ? <img src={v.default_og_image} alt="" className="max-h-32 rounded-md border border-border object-cover" /> : null}
                <div className="flex gap-2">
                  <Input {...register("default_og_image")} placeholder="https://…" />
                  <ImageUploadButton
                    className="shrink-0"
                    maxBytes={SEO_IMAGE_MAX_BYTES}
                    disabled={!canEdit}
                    onUploaded={(url) => setValue("default_og_image", url, { shouldDirty: true })}
                  />
                </div>
              </div>
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Built-in pages" description="Search titles and descriptions for pages that come with the store." />
          <CardContent className="space-y-2">
            {PAGE_KEYS.map((key) => (
              <Disclosure
                key={key}
                title={PAGE_META_LABEL[key].label}
                summary={v.page_meta[key]?.meta_title || `Default · ${PAGE_META_LABEL[key].path}`}
              >
                <div className="space-y-4">
                  <FormField label="Search title" aside={<MetaLengthCounter length={v.page_meta[key]?.meta_title?.length ?? 0} ideal={META_LIMITS.title} />}>
                    <Input {...register(`page_meta.${key}.meta_title`)} maxLength={META_LIMITS.titleMax} />
                  </FormField>
                  <FormField
                    label="Search description"
                    aside={<MetaLengthCounter length={v.page_meta[key]?.meta_description?.length ?? 0} ideal={META_LIMITS.description} />}
                  >
                    <Textarea size="sm" {...register(`page_meta.${key}.meta_description`)} maxLength={META_LIMITS.descriptionMax} />
                  </FormField>
                </div>
              </Disclosure>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Search engines and social" />
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Google Search Console code" hint='The content="…" value from the HTML tag method'>
                <Input {...register("google_verification")} />
              </FormField>
              <FormField label="Bing Webmaster code">
                <Input {...register("bing_verification")} />
              </FormField>
            </div>
            <FormField label="Social profiles" hint="Your Facebook, Instagram and similar pages, so Google links them to your store">
              <Controller
                control={control}
                name="social_profiles"
                render={({ field }) => (
                  <StringListField values={field.value} onChange={field.onChange} placeholder="https://facebook.com/yourstore" addLabel="Add profile" />
                )}
              />
            </FormField>
            <FormField label="Hide paths from search engines" hint="Added to robots.txt. Cart and checkout are already hidden.">
              <Controller
                control={control}
                name="robots_disallow"
                render={({ field }) => <StringListField values={field.value} onChange={field.onChange} placeholder="/account" addLabel="Add path" />}
              />
            </FormField>
            <p className="text-xs text-fg/55">
              Your sitemap is at {settings.storefront_url}/sitemap.xml. Submit it in Google Search Console once.
            </p>
          </CardContent>
        </Card>
      </fieldset>
      {canEdit ? (
        <UnsavedChangesBar visible={isDirty} saving={mutation.isPending} formId={FORM_ID} onDiscard={() => reset(toFormValues(settings))} />
      ) : null}
    </form>
  );
}
