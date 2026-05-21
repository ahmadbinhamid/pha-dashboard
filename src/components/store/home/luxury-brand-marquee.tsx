import { MARQUEE_BRANDS } from "@/lib/store/data/home-mock";

export function LuxuryBrandMarquee() {
  const row = [...MARQUEE_BRANDS, ...MARQUEE_BRANDS];

  return (
    <section className="border-y border-white/5 bg-surface py-10">
      <p className="mb-6 text-center text-[10px] font-semibold uppercase tracking-[0.35em] text-fg/40">
        Authorised supply partners
      </p>
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-linear-to-r from-surface to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-linear-to-l from-surface to-transparent" />
        <div className="flex w-max animate-marquee items-center">
          {row.map((brand, i) => (
            <span
              key={`${brand}-${i}`}
              className="mx-10 whitespace-nowrap text-sm font-semibold tracking-[0.2em] text-white/30 transition duration-300 hover:text-accent sm:text-base"
            >
              {brand.toUpperCase()}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
