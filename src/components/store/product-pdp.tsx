"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { StoreProduct } from "@/lib/store/data/catalog";
import { getRelatedProducts } from "@/lib/store/data/catalog";
import { formatCurrency } from "@/lib/format";
import { ProductCard } from "@/components/store/product-card";
import { StoreButton } from "@/components/store/ui/button";
import { StoreInput } from "@/components/store/ui/input";
import { useToast } from "@/components/toast/toast-provider";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

type PdpTab = "overview" | "fitment" | "delivery" | "enquiry";

export function ProductPdp({ product }: { product: StoreProduct }) {
  const { toast } = useToast();
  const allImages = useMemo(() => [...new Set([product.image, ...product.images])], [product]);
  const [activeImg, setActiveImg] = useState(allImages[0] ?? product.image);
  const [tab, setTab] = useState<PdpTab>("overview");
  const [qty, setQty] = useState(1);
  const related = useMemo(() => getRelatedProducts(product.slug, 4), [product.slug]);

  const tabBtn = (id: PdpTab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={cn(
        "relative shrink-0 border-b-2 px-1 pb-3 text-sm font-semibold transition",
        tab === id ? "border-accent text-fg" : "border-transparent text-fg/55 hover:text-fg/80",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="pb-16">
      <div className="border-b border-border bg-bg-2/50">
        <nav className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-1 gap-y-1 px-4 py-3 text-[13px] text-fg/60 sm:px-6 lg:px-8">
          <Link href="/parts" className="font-medium text-accent hover:underline">
            Parts
          </Link>
          <Icons.ChevronRight className="inline h-3.5 w-3.5 shrink-0 text-fg/35" aria-hidden />
          <Link href={`/parts?category=${encodeURIComponent(product.category)}`} className="hover:text-fg hover:underline">
            {product.category}
          </Link>
          <Icons.ChevronRight className="inline h-3.5 w-3.5 shrink-0 text-fg/35" aria-hidden />
          <Link href={`/parts?brand=${encodeURIComponent(product.brand)}`} className="hover:text-fg hover:underline">
            {product.brand}
          </Link>
          <Icons.ChevronRight className="inline h-3.5 w-3.5 shrink-0 text-fg/35" aria-hidden />
          <span className="line-clamp-1 min-w-0 font-mono text-xs text-fg/75">{product.sku}</span>
        </nav>
      </div>

      <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:py-10">
        <div className="min-w-0 space-y-8 lg:col-span-7">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm ring-1 ring-border/40">
            <div className="bg-bg-2/60 p-4 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:gap-5">
                {allImages.length > 1 ? (
                  <div className="flex flex-row gap-2 overflow-x-auto pb-1 lg:w-[5.5rem] lg:flex-shrink-0 lg:flex-col lg:overflow-y-auto lg:pb-0 lg:pr-1">
                    {allImages.map((src) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() => setActiveImg(src)}
                        className={cn(
                          "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-bg transition sm:h-[4.5rem] sm:w-[4.5rem] lg:h-20 lg:w-20",
                          src === activeImg
                            ? "border-accent shadow-md ring-2 ring-accent/25"
                            : "border-border/80 opacity-80 hover:opacity-100",
                        )}
                      >
                        <Image src={src} alt="" fill className="object-cover" sizes="80px" />
                      </button>
                    ))}
                  </div>
                ) : null}

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative min-h-[280px] flex-1 overflow-hidden rounded-xl border border-border/70 bg-bg sm:min-h-[360px] lg:aspect-square lg:min-h-0"
                >
                  <Image
                    src={activeImg}
                    alt={product.name}
                    fill
                    className="object-contain p-4 sm:p-6"
                    priority
                    sizes="(max-width: 1024px) 100vw, 640px"
                  />
                </motion.div>
              </div>
            </div>

            <div className="grid divide-y divide-border border-t border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent ring-1 ring-accent/20">
                  <Icons.Cart className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-fg">Dispatch</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-fg/60">{product.warehouse}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ok/10 text-ok ring-1 ring-ok/25">
                  <Icons.Box className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-fg">Availability</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-fg/60">
                    {product.inStock ? "In stock for online orders (demo)." : "Currently unavailable."}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-warn/10 text-warn ring-1 ring-warn/25">
                  <Icons.Tag className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-fg">Genuine / aftermarket</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-fg/60 capitalize">{product.genuineType} · {product.condition}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm ring-1 ring-border/40">
            <div className="flex gap-6 overflow-x-auto border-b border-border px-4 sm:px-6" role="tablist">
              {tabBtn("overview", "Overview")}
              {tabBtn("fitment", "Fitment")}
              {tabBtn("delivery", "Delivery")}
              {tabBtn("enquiry", "Enquiry")}
            </div>
            <div className="px-4 py-5 sm:px-6 sm:py-6">
              {tab === "overview" ? (
                <div className="prose prose-sm max-w-none text-fg/80 dark:prose-invert">
                  <p className="text-sm leading-relaxed">{product.description}</p>
                </div>
              ) : null}
              {tab === "fitment" ? (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-fg">
                    {product.make} {product.model} ({product.yearFrom}–{product.yearTo})
                  </p>
                  <ul className="list-inside list-disc space-y-2 text-sm text-fg/75">
                    {product.compatibility.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {tab === "delivery" ? (
                <div className="space-y-3 text-sm text-fg/75">
                  <p>{product.shippingNote}</p>
                  <p className="rounded-lg border border-border/60 bg-bg-2/40 px-3 py-2 text-xs text-fg/60">
                    Pickup and regional surcharges will reflect your live commerce rules when connected.
                  </p>
                </div>
              ) : null}
              {tab === "enquiry" ? (
                <div>
                  <p className="text-sm text-fg/70">We’ll route this to your CRM / inbox when the backend is ready.</p>
                  <form
                    className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      toast({ tone: "success", title: "Enquiry sent (demo)", description: "Backend email API pending." });
                    }}
                  >
                    <StoreInput required placeholder="Your name" className="sm:col-span-2" name="name" />
                    <StoreInput required type="email" placeholder="Email" name="email" />
                    <StoreInput placeholder="Phone" name="phone" />
                    <StoreInput required placeholder="Message" className="sm:col-span-2" name="message" />
                    <StoreButton type="submit" className="sm:col-span-2">
                      Submit enquiry
                    </StoreButton>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="lg:col-span-5">
          <div className="lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-md ring-1 ring-border/50">
              <div className="border-b border-border bg-bg-2/40 px-5 py-4 sm:px-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-fg/50">Part #</p>
                <p className="mt-1 font-mono text-lg font-semibold tracking-tight text-fg">{product.sku}</p>
              </div>
              <div className="px-5 py-5 sm:px-6 sm:py-6">
                <p className="text-sm font-semibold text-accent">{product.brand}</p>
                <h1 className="mt-2 text-balance text-2xl font-bold leading-tight tracking-tight text-fg sm:text-[1.65rem]">
                  {product.name}
                </h1>

                <div className="mt-6 border-t border-border/70 pt-6">
                  <p className="text-xs font-medium text-fg/55">Your price</p>
                  <div className="mt-1 flex flex-wrap items-end gap-3">
                    <span className="text-3xl font-bold tabular-nums tracking-tight text-fg sm:text-4xl">
                      {formatCurrency(product.priceAud, "AUD")}
                    </span>
                    <span className="mb-1 rounded-full bg-bg-2 px-2.5 py-0.5 text-xs font-semibold text-fg/60 ring-1 ring-border">inc. GST</span>
                  </div>
                  {product.inStock ? (
                    <p className="mt-2 text-sm font-medium text-ok">In stock</p>
                  ) : (
                    <p className="mt-2 text-sm font-medium text-danger">Out of stock</p>
                  )}
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-stretch gap-2">
                    <div className="flex w-28 flex-col justify-center rounded-xl border border-border bg-bg px-2 py-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-fg/50">Qty</span>
                      <StoreInput
                        value={String(qty)}
                        onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                        className="mt-0 border-0 bg-transparent p-0 text-center text-lg font-semibold shadow-none focus-visible:ring-0"
                        inputMode="numeric"
                      />
                    </div>
                    <StoreButton
                      type="button"
                      className="min-h-[3.25rem] flex-1 text-base font-semibold"
                      disabled={!product.inStock}
                      onClick={() =>
                        toast({
                          tone: "success",
                          title: "Added to cart (demo)",
                          description: `${qty} × ${product.name} — connect checkout when ready.`,
                        })
                      }
                    >
                      Add to cart
                    </StoreButton>
                  </div>
                  <StoreButton asChild variant="secondary" className="w-full">
                    <Link href="/parts">Continue shopping</Link>
                  </StoreButton>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <h2 className="text-lg font-semibold tracking-tight text-fg">Related products</h2>
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((p, i) => (
            <ProductCard key={p.slug} product={p} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
