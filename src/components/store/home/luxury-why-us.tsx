import { WHY_CHOOSE_US } from "@/lib/store/data/home-mock";

export function LuxuryWhyUs() {
  return (
    <section className="border-t border-white/5 bg-surface py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl animate-fade-slide text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">Why Parts Hub</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-fg sm:text-3xl">Built for workshops &amp; enthusiasts</h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {WHY_CHOOSE_US.map((item, i) => (
            <div
              key={item.title}
              className="animate-fade-slide rounded-2xl border border-white/8 bg-luxury-card/80 p-6 transition hover:border-gold/25 hover:shadow-glow-gold"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <p className="text-2xl font-bold text-white">{item.title}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-accent">{item.subtitle}</p>
              <p className="mt-4 text-sm leading-relaxed text-fg/55">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
