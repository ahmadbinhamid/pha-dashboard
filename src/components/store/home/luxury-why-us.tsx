"use client";

import { motion } from "framer-motion";
import { WHY_CHOOSE_US } from "@/lib/store/data/home-mock";

export function LuxuryWhyUs() {
  return (
    <section className="border-t border-white/5 bg-surface py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">Why Parts Hub</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-fg sm:text-3xl">Built for workshops &amp; enthusiasts</h2>
        </motion.div>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {WHY_CHOOSE_US.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="rounded-2xl border border-white/8 bg-[#151C28]/80 p-6 transition hover:border-gold/25 hover:shadow-glow-gold"
            >
              <p className="text-2xl font-bold text-white">{item.title}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-accent">{item.subtitle}</p>
              <p className="mt-4 text-sm leading-relaxed text-fg/55">{item.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
