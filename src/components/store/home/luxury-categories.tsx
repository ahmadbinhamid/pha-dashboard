import Image from "next/image";
import Link from "next/link";
import { LUXURY_CATEGORY_CARDS } from "@/lib/store/data/home-mock";

export function LuxuryCategories() {
  return (
    <section className="border-t border-white/5 bg-surface py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl animate-fade-slide text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">Collections</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-fg sm:text-3xl">Featured marques</h2>
          <p className="mt-3 text-sm text-fg/55 sm:text-base">
            Curated category gateways — OEM, performance, and verified used inventory.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {LUXURY_CATEGORY_CARDS.map((cat, i) => (
            <div
              key={cat.slug}
              className="animate-fade-slide"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <Link
                href={cat.href}
                className="group relative block overflow-hidden rounded-2xl border border-white/8 bg-surface-elevated shadow-card transition duration-500 hover:border-accent/35 hover:shadow-glow"
              >
                <div className="relative aspect-16/11 overflow-hidden">
                  <Image
                    src={cat.image}
                    alt=""
                    fill
                    className="object-cover transition duration-700 ease-out group-hover:scale-105"
                    sizes="(max-width:1024px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-[#0B0F14] via-[#0B0F14]/40 to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="h-px w-8 bg-gold/80" aria-hidden />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gold">Explore</span>
                  </div>
                  <h3 className="text-lg font-bold text-white sm:text-xl">{cat.title}</h3>
                  <p className="mt-1 text-sm text-white/60">{cat.subtitle}</p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
