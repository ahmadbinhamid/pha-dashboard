"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icons } from "@/components/ui/icons";
import { buttonClassName } from "@/components/ui/button-styles";
import { useInventory } from "@/components/inventory/inventory-store";
import { getProductViewExtras } from "@/lib/data/product-view-dummy";
import type { InventoryItem } from "@/lib/data/inventory";
import { cn } from "@/lib/cn";
import { useCounterCart } from "@/components/counter/counter-cart-store";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/toast/toast-provider";

function ebayBadgeVariant(status: InventoryItem["ebay"]) {
  if (status === "synced") return "ok" as const;
  if (status === "pending") return "warn" as const;
  if (status === "error") return "danger" as const;
  return "muted" as const;
}

function ebayLabel(status: InventoryItem["ebay"]) {
  if (status === "synced") return "Synced";
  if (status === "pending") return "Pending";
  if (status === "error") return "Error";
  return "Not listed";
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-bg/80 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-fg/45">{label}</div>
      <div className="mt-1 text-lg font-semibold tracking-tight text-fg">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-fg/55">{sub}</div> : null}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-xs font-medium text-fg/50">{label}</span>
      <span className="text-sm font-medium text-fg sm:text-right">{value}</span>
    </div>
  );
}

export function ProductDetails({ productId }: { productId: string }) {
  const router = useRouter();
  const { items } = useInventory();
  const product = useMemo(() => items.find((p) => p.id === productId), [items, productId]);

  const photos = useMemo(() => {
    if (!product) return [];
    const list: string[] = [];
    if (product.imageUrl?.trim()) list.push(product.imageUrl.trim());
    for (const u of product.galleryUrls ?? []) {
      const t = typeof u === "string" ? u.trim() : "";
      if (t && !list.includes(t)) list.push(t);
    }
    return [...new Set(list)];
  }, [product]);

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useEffect(() => {
    queueMicrotask(() => setActivePhotoIndex(0));
  }, [productId]);

  const [copied, setCopied] = useState(false);
  const [qty, setQty] = useState(1);
  const { addLine } = useCounterCart();
  const { toast } = useToast();

  if (!product) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <Card>
          <CardContent className="space-y-4 px-6 py-12">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-bg-2 text-fg/45 ring-1 ring-border">
              <Icons.Box className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-fg">Product not found</h1>
              <p className="mt-2 text-sm text-fg/65">
                No inventory line matches <span className="font-mono text-fg">{productId}</span>. It may have been
                removed or the link is wrong.
              </p>
            </div>
            <Link href="/inventory" className={buttonClassName({ variant: "primary", size: "md", className: "inline-flex" })}>
              Back to inventory
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const extras = getProductViewExtras(product.id);

  const activePhotoSrc = photos.length ? photos[Math.min(activePhotoIndex, photos.length - 1)]! : null;

  const margin = product.price - product.cost;
  const marginPct = ((margin / Math.max(0.01, product.price)) * 100).toFixed(1);
  const heroBg = `linear-gradient(135deg, hsl(${product.image.hue} 55% 42% / 0.12) 0%, transparent 55%)`;

  const copySku = () => {
    void navigator.clipboard.writeText(product.sku);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 text-[13px] sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-fg/55">
          <Link href="/inventory" className="font-medium text-accent hover:underline">
            Inventory
          </Link>
          <Icons.ChevronRight className="inline h-3.5 w-3.5 text-fg/30" aria-hidden />
          <Link href={`/inventory?category=${encodeURIComponent(product.category)}`} className="hover:underline">
            {product.category}
          </Link>
          <Icons.ChevronRight className="inline h-3.5 w-3.5 text-fg/30" aria-hidden />
          <span className="font-mono text-xs text-fg/70">{product.sku}</span>
        </nav>
        <Link
          href="/inventory"
          className={buttonClassName({
            variant: "ghost",
            size: "sm",
            className: "h-8 gap-1.5 self-start text-fg/60 sm:self-auto",
          })}
        >
          <Icons.ChevronLeft className="h-4 w-4" />
          All products
        </Link>
      </div>

      <Card className="overflow-hidden ring-1 ring-border/80">
        <div className="border-b border-border/70 px-4 py-6 sm:px-8 sm:py-8" style={{ backgroundImage: heroBg }}>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            <div className="mx-auto w-full max-w-xl shrink-0 lg:mx-0 lg:max-w-md xl:max-w-xl">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border/80 bg-bg-2 shadow-inner ring-1 ring-inset ring-black/5">
                {activePhotoSrc ? (
                  <Image
                    src={activePhotoSrc}
                    alt={product.image.alt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 560px"
                    priority
                  />
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      backgroundImage: `linear-gradient(155deg, hsl(${product.image.hue} 78% 42% / 0.5), hsl(${product.image.hue} 50% 22% / 0.75))`,
                    }}
                  >
                    <span className="text-5xl font-bold tracking-tight text-white/95 drop-shadow-md sm:text-6xl">
                      {product.image.initials}
                    </span>
                  </div>
                )}
              </div>
              {photos.length > 1 ? (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Product photos">
                  {photos.map((url, i) => (
                    <button
                      key={`${i}-${url.slice(-24)}`}
                      type="button"
                      role="tab"
                      aria-selected={i === activePhotoIndex}
                      onClick={() => setActivePhotoIndex(i)}
                      className={cn(
                        "relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition sm:h-16 sm:w-16",
                        i === activePhotoIndex
                          ? "border-accent ring-2 ring-accent/30"
                          : "border-transparent opacity-75 hover:opacity-100",
                      )}
                    >
                      <Image src={url} alt="" fill className="object-cover" sizes="64px" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-6">
              <div>
                <h1 className="text-balance text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{product.title}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {product.sku}
                  </Badge>
                  <Badge variant="outline">{product.category}</Badge>
                  <Badge variant={ebayBadgeVariant(product.ebay)}>{ebayLabel(product.ebay)}</Badge>
                  <Badge variant={product.stock <= 0 ? "danger" : product.stock <= 15 ? "warn" : "ok"}>
                    {product.stock} in stock
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={copySku}>
                  {copied ? "Copied" : "Copy SKU"}
                </Button>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-2 py-1">
                  <span className="text-xs font-semibold text-fg/60">Qty</span>
                  <Input
                    value={String(qty)}
                    onChange={(e) => setQty(Number(e.target.value || 1))}
                    className="h-8 w-16 text-center"
                    inputMode="numeric"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      addLine(
                        { productId: product.id, sku: product.sku, title: product.title, unitPriceInclGst: product.price },
                        qty,
                      );
                      toast({ tone: "success", title: "Added to cart", description: `${qty} × ${product.title}` });
                    }}
                  >
                    Add to cart
                  </Button>
                </div>
                <Button type="button" variant="secondary" size="sm">
                  Preview listing
                </Button>
                <Button type="button" size="sm" onClick={() => router.push("/inventory/new")}>
                  Add similar
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Sell price" value={formatCurrency(product.price)} sub="inc. GST where applicable" />
            <Stat label="Cost" value={formatCurrency(product.cost)} />
            <Stat label="Margin" value={formatCurrency(margin)} sub={`${marginPct}% of sell`} />
            <Stat label="Channel sync" value={extras.lastChannelSync.split(",")[0] ?? extras.lastChannelSync} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <Card>
            <CardHeader title="Product" description="Core catalogue fields (demo — connect API to edit live data)." />
            <CardContent>
              <DataRow label="Title" value={product.title} />
              <DataRow label="SKU" value={<span className="font-mono">{product.sku}</span>} />
              <DataRow label="Category" value={product.category} />
              <DataRow
                label="Fitment"
                value={
                  <span>
                    {product.make} {product.model} ({product.yearFrom}–{product.yearTo})
                  </span>
                }
              />
              <DataRow label="Brand" value="Parts Hub Australia" />
              <DataRow label="Condition" value="New" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Supplier & logistics" description="Dummy supplier and warehouse data." />
            <CardContent>
              <DataRow label="Supplier" value={extras.supplier} />
              <DataRow label="Supplier SKU" value={<span className="font-mono">{extras.supplierSku}</span>} />
              <DataRow label="Bin location" value={extras.binLocation} />
              <DataRow label="Country of origin" value={extras.countryOfOrigin} />
              <DataRow
                label="Dimensions (L × W × H)"
                value={`${extras.lengthMm} × ${extras.widthMm} × ${extras.heightMm} mm`}
              />
              <DataRow label="Weight" value={`${extras.weightKg} kg`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Inventory" description="Reorder targets (demo values)." />
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="On hand" value={product.stock} />
                <Stat label="Reorder at" value={extras.reorderPoint} />
                <Stat label="Reorder qty" value={extras.reorderQty} />
              </div>
              <p className="mt-4 rounded-lg border border-border/60 bg-bg-2/40 px-3 py-2 text-sm text-fg/70">{extras.notes}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="eBay Motors"
              description="Listing identifiers are placeholders until eBay is connected."
              right={
                extras.listingId ? (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {extras.listingId}
                  </Badge>
                ) : null
              }
            />
            <CardContent>
              <DataRow label="Sync status" value={ebayLabel(product.ebay)} />
              <DataRow label="Last sync" value={extras.lastChannelSync} />
              <DataRow label="Warranty" value={`${extras.warrantyMonths} months`} />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm">
                  Push to eBay
                </Button>
                <Button type="button" variant="secondary" size="sm">
                  Pull from eBay
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 xl:col-span-4">
          <Card className="xl:sticky xl:top-28 xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto">
            <CardHeader title="Tags" description="Merchandising labels (demo)." />
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {extras.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border/70 bg-bg-2/50 px-3 py-1 text-xs font-medium text-fg/80"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Activity" description="Recent events (dummy timeline)." />
            <CardContent className="space-y-0">
              {extras.activity.map((a, i) => (
                <div key={`${a.at}-${i}`} className="flex gap-3 border-b border-border/60 py-3 last:border-0">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent/80" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm text-fg/85">{a.text}</p>
                    <p className="mt-1 text-xs text-fg/50">{a.at}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
