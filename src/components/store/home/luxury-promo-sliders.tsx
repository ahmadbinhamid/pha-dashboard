"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PROMO_SLIDES } from "@/lib/store/data/home-mock";
import { StoreButton } from "@/components/store/ui/button";

export function LuxuryPromoSliders() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % PROMO_SLIDES.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, []);

  const slide = PROMO_SLIDES[index];

  return (
    <section className="relative h-[min(72vh,560px)] min-h-[380px] overflow-hidden bg-[#0B0F14]">
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          <Image
            src={slide.image}
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
            priority={index === 0}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F14]/95 via-[#0B0F14]/65 to-[#0B0F14]/35" />
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 flex h-full items-center">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id + "-copy"}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.5 }}
              className="max-w-xl"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">Featured</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{slide.title}</h2>
              <p className="mt-4 text-base text-white/65 sm:text-lg">{slide.subtitle}</p>
              <StoreButton asChild size="lg" className="mt-8">
                <Link href={slide.href}>{slide.cta}</Link>
              </StoreButton>
            </motion.div>
          </AnimatePresence>

          <div className="mt-10 flex gap-2">
            {PROMO_SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-10 bg-accent" : "w-3 bg-white/25 hover:bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
