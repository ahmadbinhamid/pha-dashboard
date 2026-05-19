import Link from "@/components/ui/link";
import { Image } from "@/components/ui/image";
import { useEffect, useRef, useState } from "react";
import { PROMO_SLIDES } from "@/lib/store/data/home-mock";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

export function LuxuryPromoSliders() {
  const [index, setIndex] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    const onVisibility = () => { pausedRef.current = document.hidden; };
    document.addEventListener("visibilitychange", onVisibility);

    const observer = new IntersectionObserver(
      ([entry]) => { pausedRef.current = !entry.isIntersecting; },
      { threshold: 0.1 },
    );
    if (sectionRef.current) observer.observe(sectionRef.current);

    const id = window.setInterval(() => {
      if (!pausedRef.current) setIndex((i) => (i + 1) % PROMO_SLIDES.length);
    }, 6500);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative h-[min(72vh,560px)] min-h-95 overflow-hidden bg-luxury-ink">
      {PROMO_SLIDES.map((slide, i) => (
        <div
          key={slide.id}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === index ? 1 : 0 }}
          aria-hidden={i !== index}
        >
          <Image src={slide.image} alt="" fill priority={i === 0} />
          <div className="absolute inset-0 bg-linear-to-r from-luxury-ink/95 via-luxury-ink/65 to-luxury-ink/35" />
        </div>
      ))}

      <div className="relative z-10 flex h-full flex-col justify-center">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative min-h-55">
            {PROMO_SLIDES.map((slide, i) => (
              <div
                key={slide.id + "-copy"}
                className={cn(
                  "max-w-xl transition-opacity duration-500",
                  i !== index && "pointer-events-none absolute inset-0",
                )}
                style={{ opacity: i === index ? 1 : 0 }}
                aria-hidden={i !== index}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">Featured</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{slide.title}</h2>
                <p className="mt-4 text-base text-white/65 sm:text-lg">{slide.subtitle}</p>
                <Button asChild size="lg" className="mt-8">
                  <Link href={slide.href}>{slide.cta}</Link>
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-2">
            {PROMO_SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-10 bg-accent" : "w-3 bg-white/25 hover:bg-white/40",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
