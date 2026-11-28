import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { RichTextField } from "@/components/ui/RichTextField";
import { TagInput } from "@/components/ui/TagInput";
import { Textarea } from "@/components/ui/Textarea";
import { ImageUploadButton } from "@/components/media/ImageUploadButton";
import { UnsavedChangesBar } from "@/components/shared/UnsavedChangesBar";
import { ContentPublishCard } from "@/components/seo/ContentPublishCard";
import { SeoMetaFields } from "@/components/seo/SeoMetaFields";
import { EMPTY_SEO_META, SEO_IMAGE_MAX_BYTES } from "@/config/seo";
import { useSeoSettings } from "@/hooks/useSeoSettings";
import { SEO_QUERY_KEY, getArticleTags } from "@/lib/api/seo";
import { slugify, stripHtml } from "@/lib/seo/seoText";
import { articleFormSchema, type ArticleFormValues } from "@/lib/validation/seo";
import type { Article } from "@/types/seo";

interface ArticleFormProps {
  // Null writes a new article.
  article: Article | null;
  canEdit: boolean;
  canPublish: boolean;
  saving: boolean;
  onSubmit: (values: ArticleFormValues) => void;
  onCancel: () => void;
}

const FORM_ID = "article-form";

function toFormValues(a: Article | null): ArticleFormValues {
  return {
    title: a?.title ?? "",
    slug: a?.slug ?? "",
    excerpt: a?.excerpt ?? "",
    body_html: a?.body_html ?? "",
    cover_image: a?.cover_image ?? "",
    cover_alt: a?.cover_alt ?? "",
    tags: a?.tags ?? [],
    author_name: a?.author_name ?? "",
    status: a?.status ?? "draft",
    published_at: a?.published_at ?? null,
    seo: { ...EMPTY_SEO_META, ...a?.seo },
  };
}

export function ArticleForm({ article, canEdit, canPublish, saving, onSubmit, onCancel }: ArticleFormProps) {
  const { settings } = useSeoSettings();
  const { register, control, handleSubmit, reset, setValue, formState: { errors, isDirty } } = useForm<ArticleFormValues>({
    resolver: zodResolver(articleFormSchema),
    defaultValues: toFormValues(article),
  });
  const v = useWatch({ control }) as ArticleFormValues;
  const { data: tagsRes } = useQuery({ queryKey: [...SEO_QUERY_KEY, "tags"], queryFn: getArticleTags });

  useEffect(() => reset(toFormValues(article)), [article, reset]);

  const slug = v.slug || slugify(v.title || "");
  const path = `/blog/${slug || "your-article"}`;
  const knownTags = (tagsRes?.data ?? []).map((t) => t.tag).filter((t) => !v.tags?.includes(t));
  const dirty = { shouldDirty: true } as const;

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <fieldset disabled={!canEdit} className="min-w-0 space-y-4 lg:col-span-2">
          <Card>
            <CardContent className="space-y-5 pt-5">
              <FormField label="Title" required error={errors.title?.message}>
                <Input {...register("title")} placeholder="How to change your brake pads" className="text-base" />
              </FormField>
              <FormField label="URL" hint={`${settings?.storefront_url ?? ""}${path}`} error={errors.slug?.message}>
                <Input {...register("slug")} placeholder={slugify(v.title || "") || "how-to-change-brake-pads"} />
              </FormField>
              <Controller
                control={control}
                name="body_html"
                render={({ field }) => (
                  <RichTextField
                    label="Article"
                    value={field.value}
                    onChange={field.onChange}
                    minHeight="420px"
                    placeholder="Start writing…"
                    disabled={!canEdit}
                    enableLinks
                    enableImages
                  />
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Search and social" description="How this article shows up in Google and when shared." />
            <CardContent>
              <Controller
                control={control}
                name="seo"
                render={({ field }) => (
                  <SeoMetaFields
                    value={field.value}
                    onChange={field.onChange}
                    fallbackTitle={v.title || ""}
                    fallbackDescription={v.excerpt || stripHtml(v.body_html || "")}
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
            onStatusChange={(status) => setValue("status", status, dirty)}
            publishedAt={v.published_at}
            onPublishedAtChange={(iso) => setValue("published_at", iso, dirty)}
            savedState={article?.state ?? null}
            liveUrl={article ? `${settings?.storefront_url ?? ""}/blog/${article.slug}` : null}
            canPublish={canPublish && canEdit}
          />
          <fieldset disabled={!canEdit} className="min-w-0">
            <Card>
              <CardHeader title="Details" />
              <CardContent className="space-y-4">
                <FormField label="Cover image" hint="Shown on the blog list and at the top of the article">
                  <div className="space-y-2">
                    {v.cover_image ? <img src={v.cover_image} alt="" className="aspect-video w-full rounded-md object-cover" /> : null}
                    <ImageUploadButton
                      maxBytes={SEO_IMAGE_MAX_BYTES}
                      size="sm"
                      disabled={!canEdit}
                      label={v.cover_image ? "Replace" : "Upload"}
                      onUploaded={(url) => setValue("cover_image", url, dirty)}
                    />
                  </div>
                </FormField>
                <FormField label="Image description" hint="For screen readers and Google Images">
                  <Input {...register("cover_alt")} />
                </FormField>
                <FormField label="Summary" hint="Shown on the blog list. Blank uses the opening lines.">
                  <Textarea size="sm" {...register("excerpt")} maxLength={400} />
                </FormField>
                <FormField label="Tags" hint={knownTags.length ? `Used before: ${knownTags.slice(0, 6).join(", ")}` : "Press Enter after each tag"}>
                  <Controller
                    control={control}
                    name="tags"
                    render={({ field }) => <TagInput value={field.value} onChange={field.onChange} placeholder="e.g. Brakes, DIY" />}
                  />
                </FormField>
                <FormField label="Author">
                  <Input {...register("author_name")} placeholder="The team" />
                </FormField>
              </CardContent>
            </Card>
          </fieldset>
        </div>
      </div>
      {canEdit ? (
        <UnsavedChangesBar
          visible={!article || isDirty}
          saving={saving}
          formId={FORM_ID}
          saveLabel={article ? "Save changes" : "Create article"}
          onDiscard={() => (article ? reset(toFormValues(article)) : onCancel())}
        />
      ) : null}
    </form>
  );
}
