"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import type { StoreProduct } from "@/lib/store/data/catalog";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/toast/toast-provider";
import { cn } from "@/lib/cn";

function conditionLabel(p: StoreProduct) {
  if (p.condition === "used") return "Used";
  if (p.genuineType === "genuine") return "OEM";
  return "New";
}

export function LuxuryFeaturedProducts({ products }: { products: StoreProduct[] }) {
  const [quickView, setQuickView] = useState<StoreProduct | null>(null);
  const { toast } = useToast();

  return (
    <>
      <section className="border-t border-white/5 bg-[#0B0F14] py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">Inventory</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-fg sm:text-3xl">Featured parts</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-fg/55">
              Real-world SKUs — pricing in AUD (inc. GST). ERP sync ready.
            </p>
          </motion.div>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p, i) => (
              <motion.article
                key={p.slug}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.24) }}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-surface-elevated transition duration-300 hover:border-accent/30 hover:shadow-glow"
              >
                <Link href={`/parts/${p.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-surface">
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    sizes="(max-width:1024px) 50vw, 25vw"
                  />
                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        p.condition === "used"
                          ? "bg-gold/20 text-gold"
                          : p.genuineType === "genuine"
                            ? "bg-accent/25 text-accent"
                            : "bg-white/15 text-white",
                      )}
                    >
                      {conditionLabel(p)}
                    </span>
                    {p.inStock ? (
                      <span className="rounded-md bg-ok/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ok">
                        In stock
                      </span>
                    ) : (
                      <span className="rounded-md bg-warn/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warn">
                        Waitlist
                      </span>
                    )}
                  </div>
                </Link>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-fg/45">{p.brand}</p>
                  <Link href={`/parts/${p.slug}`}>
                    <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-fg transition group-hover:text-accent">
                      {p.name}
                    </h3>
                  </Link>
                  <p className="mt-2 font-mono text-[11px] text-fg/45">{p.sku}</p>
                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <span className="text-lg font-bold tabular-nums text-fg">{formatCurrency(p.priceAud, "AUD")}</span>
                    <span className="text-[10px] text-fg/40">inc. GST</span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        toast({
                          tone: "default",
                          title: "Added to cart (demo)",
                          description: p.name,
                        })
                      }
                    >
                      Add to cart
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-white/15 bg-transparent text-fg hover:bg-white/5"
                      onClick={() => setQuickView(p)}
                    >
                      Quick view
                    </Button>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <Dialog
        open={!!quickView}
        onClose={() => setQuickView(null)}
        title={quickView?.name ?? ""}
        className="border-white/10 bg-surface-elevated text-fg"
      >
        {quickView ? (
          <div className="space-y-4">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-surface">
              <Image src={quickView.image} alt="" fill className="object-cover" />
            </div>
            <p className="font-mono text-xs text-fg/50">{quickView.sku}</p>
            <p className="text-2xl font-bold">{formatCurrency(quickView.priceAud, "AUD")}</p>
            <p className="text-sm text-fg/65 line-clamp-4">{quickView.description}</p>
            <Button asChild className="w-full">
              <Link href={`/parts/${quickView.slug}`}>View full details</Link>
            </Button>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
