import { ArrowRight } from "lucide-react";
import { Image } from "@/components/ui/Image";
import type { HeroAlign, HeroImageFocus, HeroSlide, HeroVertical } from "@/types/storefront";
import { cn } from "@/utils/cn";

const ALIGN_CLASS: Record<HeroAlign, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
};
const VERTICAL_CLASS: Record<HeroVertical, string> = { top: "justify-start", center: "justify-center", bottom: "justify-end" };
const FOCUS_CLASS: Record<HeroImageFocus, string> = {
  center: "object-center",
  top: "object-top",
  bottom: "object-bottom",
  left: "object-left",
  right: "object-right",
};

interface HeroSlideViewProps {
  slide: HeroSlide;
  // Phone preview: uses the mobile photo when one is set.
  mobile?: boolean;
  className?: string;
}

// Sizes by container query, so it scales to the simulated device width.
export function HeroSlideView({ slide, mobile = false, className }: HeroSlideViewProps) {
  const dark = slide.text_tone === "dark";
  const image = mobile && slide.mobile_image_url ? slide.mobile_image_url : slide.image_url;
  return (
    <div className={cn("@container relative overflow-hidden bg-luxury-ink", className)}>
      {image ? <Image src={image} alt="" fill priority className={FOCUS_CLASS[slide.image_focus]} /> : null}
      {/* Dark text gets a light wash instead of a dark scrim. */}
      <div className={cn("absolute inset-0", dark ? "bg-white" : "bg-black")} style={{ opacity: slide.overlay / 100 }} />
      <div
        className={cn(
          "relative flex h-full flex-col gap-2 px-6 py-8 @lg:px-10 @3xl:gap-3 @3xl:px-16",
          ALIGN_CLASS[slide.align],
          VERTICAL_CLASS[slide.vertical],
        )}
      >
        {slide.badge ? (
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-3xs font-bold tracking-wider text-accent-fg uppercase @3xl:text-2xs">
            {slide.badge}
          </span>
        ) : null}
        <h2 className={cn("max-w-xl text-xl leading-tight font-bold @lg:text-3xl @3xl:text-5xl", dark ? "text-luxury-ink" : "text-white")}>
          {slide.title || "Your slide title"}
        </h2>
        {slide.subtitle ? (
          <p className={cn("max-w-lg text-xs @lg:text-sm @3xl:text-base", dark ? "text-luxury-ink/80" : "text-white/80")}>{slide.subtitle}</p>
        ) : null}
        {slide.cta_label || slide.secondary_cta_label ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {slide.cta_label ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-fg @3xl:text-sm">
                {slide.cta_label}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            ) : null}
            {slide.secondary_cta_label ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-lg px-4 py-2 text-xs font-semibold ring-1 ring-inset @3xl:text-sm",
                  dark ? "text-luxury-ink ring-luxury-ink/40" : "text-white ring-white/50",
                )}
              >
                {slide.secondary_cta_label}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
