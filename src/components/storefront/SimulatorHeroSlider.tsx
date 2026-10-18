import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { HeroSlideView } from "@/components/storefront/HeroSlideView";
import { HERO_HEIGHT_CLASS } from "@/config/storefront";
import type { HeroSettings, HeroSlide } from "@/types/storefront";
import { cn } from "@/utils/cn";

interface SimulatorHeroSliderProps {
  slides: HeroSlide[];
  settings: HeroSettings;
  // Phone preview: slides use their phone photo when set.
  mobile: boolean;
}

export function SimulatorHeroSlider({ slides, settings, mobile }: SimulatorHeroSliderProps) {
  const [index, setIndex] = useState(0);
  const count = slides.length;
  const current = count ? index % count : 0;
  const heightClass = HERO_HEIGHT_CLASS[settings.height];

  // Depends on index so a manual step restarts the autoplay timer.
  useEffect(() => {
    if (count < 2 || !settings.autoplay) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % count), settings.interval_seconds * 1000);
    return () => window.clearTimeout(id);
  }, [count, index, settings.autoplay, settings.interval_seconds]);

  if (!count) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2 bg-bg-2 text-xs text-fg/50", heightClass)}>
        <ImageOff className="h-5 w-5" />
        No active hero slides
      </div>
    );
  }

  const step = (delta: number) => setIndex((current + delta + count) % count);

  return (
    <div className="relative">
      <HeroSlideView key={slides[current]._id ?? current} slide={slides[current]} mobile={mobile} className={cn("animate-fade-in", heightClass)} />
      {count > 1 ? (
        <>
          {settings.show_arrows ? (
            <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Previous slide"
            onClick={() => step(-1)}
            className="absolute top-1/2 left-3 h-8 w-8 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Next slide"
            onClick={() => step(1)}
            className="absolute top-1/2 right-3 h-8 w-8 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
            </>
          ) : null}
          {settings.show_dots ? (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s._id ?? i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn("h-1.5 rounded-full transition-all", i === current ? "w-5 bg-white" : "w-1.5 bg-white/50")}
              />
            ))}
          </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
