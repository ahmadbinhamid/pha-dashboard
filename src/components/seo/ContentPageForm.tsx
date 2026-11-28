import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { RichTextField } from "@/components/ui/RichTextField";
import { Switch } from "@/components/ui/Switch";
import { UnsavedChangesBar } from "@/components/shared/UnsavedChangesBar";
import { ContentPublishCard } from "@/components/seo/ContentPublishCard";
import { SeoMetaFields } from "@/components/seo/SeoMetaFields";
import { EMPTY_SEO_META } from "@/config/seo";
import { useSeoSettings } from "@/hooks/useSeoSettings";
import { slugify, stripHtml } from "@/lib/seo/seoText";
import { contentPageFormSchema, type ContentPageFormValues } from "@/lib/validation/seo";
import type { ContentPage } from "@/types/seo";

interface ContentPageFormProps {
  // Null creates a new page.
  page: ContentPage | null;
  canEdit: boolean;
  canPublish: boolean;
  saving: boolean;
  onSubmit: (values: ContentPageFormValues) => void;
  onCancel: () => void;
}

const FORM_ID = "content-page-form";

function toFormValues(p: ContentPage | null): ContentPageFormValues {
  return {
    title: p?.title ?? "",
    slug: p?.slug ?? "",
    body_html: p?.body_html ?? "",
    status: p?.status ?? "draft",
    show_in_footer: p?.show_in_footer ?? false,
    footer_order: p?.footer_order ?? 0,
    seo: { ...EMPTY_SEO_META, ...p?.seo },
  };
}

export function ContentPageForm({ page, canEdit, canPublish, saving, onSubmit, onCancel }: ContentPageFormProps) {
  const { settings } = useSeoSettings();
  const { register, control, handleSubmit, reset, setValue, formState: { errors, isDirty } } = useForm<ContentPageFormValues>({
    resolver: zodResolver(contentPageFormSchema),
    defaultValues: toFormValues(page),
  });
  const v = useWatch({ control }) as ContentPageFormValues;

  useEffect(() => reset(toFormValues(page)), [page, reset]);

  const path = `/pages/${v.slug || slugify(v.title || "") || "your-page"}`;
  const savedState = page ? (page.status === "published" ? "published" : "draft") : null;

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <fieldset disabled={!canEdit} className="min-w-0 space-y-4 lg:col-span-2">
          <Card>
            <CardContent className="space-y-5 pt-5">
              <FormField label="Title" required error={errors.title?.message}>
                <Input {...register("title")} placeholder="About us" className="text-base" />
              </FormField>
              <FormField label="URL" hint={`${settings?.storefront_url ?? ""}${path}`}>
                <Input {...register("slug")} placeholder={slugify(v.title || "") || "about-us"} />
              </FormField>
              <Controller
                control={control}
                name="body_html"
                render={({ field }) => (
                  <RichTextField
                    label="Content"
                    value={field.value}
                    onChange={field.onChange}
                    minHeight="360px"
                    disabled={!canEdit}
                    enableLinks
                    enableImages
                  />
                )}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Search and social" />
            <CardContent>
              <Controller
                control={control}
                name="seo"
                render={({ field }) => (
                  <SeoMetaFields
                    value={field.value}
                    onChange={field.onChange}
                    fallbackTitle={v.title || ""}
                    fallbackDescription={stripHtml(v.body_html || "")}
                    path={path}
                    disabled={!canEdit}
                  />
                )}
              />
            </CardContent>
          </Card>
        </fieldset>

        <div className="space-y-4 lg:sticky lg:top-4">
          <ContentPublishCard
            status={v.status}
            onStatusChange={(status) => setValue("status", status, { shouldDirty: true })}
            savedState={savedState}
            liveUrl={page ? `${settings?.storefront_url ?? ""}/pages/${page.slug}` : null}
            canPublish={canPublish && canEdit}
          />
          <fieldset disabled={!canEdit} className="min-w-0">
            <Card>
              <CardHeader title="Footer" />
              <CardContent className="space-y-4">
                <Controller
                  control={control}
                  name="show_in_footer"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={!canEdit}
                      label="Link in the website footer"
                      description="Once published"
                    />
                  )}
                />
                {v.show_in_footer ? (
                  <FormField label="Footer position" hint="Lower numbers show first">
                    <Input type="number" min={0} {...register("footer_order", { valueAsNumber: true })} />
                  </FormField>
                ) : null}
              </CardContent>
            </Card>
          </fieldset>
        </div>
      </div>
      {canEdit ? (
        <UnsavedChangesBar
          visible={!page || isDirty}
          saving={saving}
          formId={FORM_ID}
          saveLabel={page ? "Save changes" : "Create page"}
          onDiscard={() => (page ? reset(toFormValues(page)) : onCancel())}
        />
      ) : null}
    </form>
  );
}
