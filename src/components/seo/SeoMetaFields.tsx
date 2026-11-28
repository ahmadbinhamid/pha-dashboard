import { Disclosure } from "@/components/ui/Disclosure";
import { Image } from "@/components/ui/Image";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { ImageUploadButton } from "@/components/media/ImageUploadButton";
import { MetaLengthCounter } from "@/components/seo/MetaLengthCounter";
import { SearchResultPreview } from "@/components/seo/SearchResultPreview";
import { META_LIMITS, SEO_IMAGE_MAX_BYTES } from "@/config/seo";
import { useSeoSettings } from "@/hooks/useSeoSettings";
import { applyTitleTemplate } from "@/lib/seo/seoText";
import type { SeoMeta } from "@/types/seo";

interface SeoMetaFieldsProps {
  value: SeoMeta;
  onChange: (value: SeoMeta) => void;
  // Used when the override is blank, exactly as the storefront does.
  fallbackTitle: string;
  fallbackDescription: string;
  // Storefront path, e.g. "/blog/brake-guide".
  path: string;
  disabled?: boolean;
}

const MIN_DESCRIPTION = 70;

export function SeoMetaFields({ value, onChange, fallbackTitle, fallbackDescription, path, disabled }: SeoMetaFieldsProps) {
  const { settings } = useSeoSettings();
  const set = (patch: Partial<SeoMeta>) => onChange({ ...value, ...patch });
  const title = applyTitleTemplate(settings?.title_template, value.meta_title || fallbackTitle);
  const description = value.meta_description || fallbackDescription || settings?.default_description || "";
  const url = `${settings?.storefront_url ?? ""}${path}`;

  return (
    <div className="space-y-4">
      <SearchResultPreview url={url} title={title} description={description} noindex={value.noindex} />
      <FormField
        label="Search title"
        hint={`Blank uses "${fallbackTitle || "the title"}". The site name is added automatically.`}
        aside={<MetaLengthCounter length={title.length} ideal={META_LIMITS.title} />}
      >
        <Input
          value={value.meta_title}
          onChange={(e) => set({ meta_title: e.target.value })}
          maxLength={META_LIMITS.titleMax}
          placeholder={fallbackTitle}
          disabled={disabled}
        />
      </FormField>
      <FormField
        label="Search description"
        hint="One or two sentences that make people click. Blank uses the opening text."
        aside={<MetaLengthCounter length={value.meta_description.length} ideal={META_LIMITS.description} min={MIN_DESCRIPTION} />}
      >
        <Textarea
          size="sm"
          value={value.meta_description}
          onChange={(e) => set({ meta_description: e.target.value })}
          maxLength={META_LIMITS.descriptionMax}
          placeholder={fallbackDescription.slice(0, META_LIMITS.description)}
          disabled={disabled}
        />
      </FormField>
      <Disclosure title="Social sharing and advanced">
        <div className="space-y-4">
          <FormField label="Social share image" hint="Shown on Facebook, WhatsApp and similar. 1200 × 630 works best.">
            <div className="space-y-2">
              {value.og_image ? <Image src={value.og_image} alt="" className="max-h-32 rounded-md border border-border object-cover" /> : null}
              <div className="flex gap-2">
                <Input value={value.og_image} onChange={(e) => set({ og_image: e.target.value })} placeholder="https://…" disabled={disabled} />
                <ImageUploadButton
                  className="shrink-0"
                  maxBytes={SEO_IMAGE_MAX_BYTES}
                  disabled={disabled}
                  onUploaded={(url) => set({ og_image: url })}
                />
              </div>
            </div>
          </FormField>
          <FormField label="Canonical URL" hint="Only if this content also lives at another address you want Google to prefer.">
            <Input value={value.canonical_url} onChange={(e) => set({ canonical_url: e.target.value })} placeholder="https://…" disabled={disabled} />
          </FormField>
          <Switch
            checked={value.noindex}
            onCheckedChange={(noindex) => set({ noindex })}
            disabled={disabled}
            label="Hide from search engines"
            description="Adds noindex and leaves it out of the sitemap. Visitors can still open it."
          />
        </div>
      </Disclosure>
    </div>
  );
}
