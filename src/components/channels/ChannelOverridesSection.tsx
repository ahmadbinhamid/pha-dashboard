import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ProductImages } from "@/components/media/ProductImages";
import { OverrideField } from "@/components/listings/OverrideField";
import { cn } from "@/utils/cn";
import type { Attachment } from "@/types/product";
import type { ListingProductDefaults } from "@/types/marketplace";

// Override fields shared by every channel form state.
export interface OverrideValues {
  title_override: string;
  description_override: string;
  price_override: string;
  photo_overrides?: Attachment[];
}

interface Props {
  values: OverrideValues;
  onChange: (patch: Partial<OverrideValues>) => void;
  productDefaults: ListingProductDefaults;
  supportsPhotos: boolean;
  titleMaxLength?: number;
  errors: Record<string, string>;
}

// "Advanced" per-channel overrides; empty means the product value is used.
export function ChannelOverridesSection({ values, onChange, productDefaults, supportsPhotos, titleMaxLength, errors }: Props) {
  const photos = values.photo_overrides ?? [];
  const overriddenCount = [
    values.title_override.trim(),
    values.description_override.trim(),
    values.price_override !== "",
    supportsPhotos && photos.length > 0,
  ].filter(Boolean).length;
  const [open, setOpen] = useState(overriddenCount > 0 || !!errors.title_override);
  const effectiveTitle = values.title_override.trim() || productDefaults.title;

  return (
    <div className="rounded-xs border border-border">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="h-auto w-full justify-between rounded-xs px-3 py-2.5 text-sm"
      >
        <span className="flex items-center gap-2">
          Advanced — override product values for this channel
          {overriddenCount > 0 && <Badge variant="warn">{overriddenCount} overridden</Badge>}
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div className="space-y-4 border-t border-border px-3 py-4">
          <OverrideField
            label="Title"
            overridden={!!values.title_override.trim()}
            onReset={() => onChange({ title_override: "" })}
            error={errors.title_override}
            hint={titleMaxLength ? `${effectiveTitle.length}/${titleMaxLength} characters` : undefined}
          >
            <Input
              value={values.title_override}
              onChange={(e) => onChange({ title_override: e.target.value })}
              placeholder={productDefaults.title}
              maxLength={titleMaxLength}
            />
          </OverrideField>

          <OverrideField
            label="Price (AUD)"
            overridden={values.price_override !== ""}
            onReset={() => onChange({ price_override: "" })}
            error={errors.price_override}
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={values.price_override}
              onChange={(e) => onChange({ price_override: e.target.value })}
              placeholder={productDefaults.price != null ? String(productDefaults.price) : "0.00"}
            />
          </OverrideField>

          <OverrideField
            label="Description"
            overridden={!!values.description_override.trim()}
            onReset={() => onChange({ description_override: "" })}
          >
            <Textarea
              value={values.description_override}
              onChange={(e) => onChange({ description_override: e.target.value })}
              placeholder="Generated from the product at sync time"
              rows={3}
            />
          </OverrideField>

          {supportsPhotos && (
            <OverrideField label="Photos" overridden={photos.length > 0} onReset={() => onChange({ photo_overrides: [] })}>
              {photos.length > 0 ? (
                <ProductImages images={photos} onChange={(imgs) => onChange({ photo_overrides: imgs })} />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xs border border-dashed border-border px-4 py-3">
                  <p className="text-sm text-fg/60">
                    Using the product&apos;s {productDefaults.photos.length} photo{productDefaults.photos.length === 1 ? "" : "s"}.
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={() => onChange({ photo_overrides: [...productDefaults.photos] })}>
                    Customise photos
                  </Button>
                </div>
              )}
            </OverrideField>
          )}
        </div>
      )}
    </div>
  );
}
