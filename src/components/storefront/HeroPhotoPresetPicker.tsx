import { ImagePlus, Loader2 } from "lucide-react";
import { Image } from "@/components/ui/Image";
import { OptionTile } from "@/components/ui/OptionTile";
import { HERO_IMAGE_MAX_BYTES, HERO_PHOTO_PRESETS } from "@/config/storefront";
import { useImageUpload } from "@/hooks/useImageUpload";

const PRESET_URLS = new Set<string>(HERO_PHOTO_PRESETS.map((p) => p.url));

/** Upload-your-own tile first, then the automotive photo presets. */
export function HeroPhotoPresetPicker({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const upload = useImageUpload({ onUploaded: onChange, maxBytes: HERO_IMAGE_MAX_BYTES });
  const custom = !!value && !PRESET_URLS.has(value);

  return (
    <div role="radiogroup" aria-label="Photo" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <input {...upload.inputProps} />
      <OptionTile selected={custom} onSelect={upload.open} disabled={upload.isUploading} className="aspect-video">
        {custom && !upload.isUploading ? (
          <>
            <Image src={value} alt="" fill className="transition-transform duration-300 group-hover:scale-105" />
            <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-2xs font-medium text-white">Your photo · click to replace</span>
          </>
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-1.5 text-fg/55">
            {upload.isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <span className="text-xs font-medium">{upload.isUploading ? "Uploading…" : "Upload your own"}</span>
            {!upload.isUploading ? <span className="text-3xs text-fg/40">JPG, PNG or WebP · wide works best</span> : null}
          </span>
        )}
      </OptionTile>
      {HERO_PHOTO_PRESETS.map((preset) => (
        <OptionTile key={preset.id} selected={preset.url === value} onSelect={() => onChange(preset.url)} className="aspect-video">
          <Image src={preset.url} alt="" fill className="transition-transform duration-300 group-hover:scale-105" />
          <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-2xs font-medium text-white">{preset.label}</span>
        </OptionTile>
      ))}
    </div>
  );
}
