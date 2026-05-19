import Link from "@/components/ui/link";
import { Image } from "@/components/ui/image";
import type { StoreProduct } from "@/lib/store/data/catalog";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/utils/cn";

export function ProductCard({ product, index = 0 }: { product: StoreProduct; index?: number }) {
  return (
    <article
      className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:shadow-card animate-fade-slide"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <Link href={`/parts/${product.slug}`} className="block">
        <div className="relative aspect-[4/3] bg-bg-2">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="transition duration-300 group-hover:scale-[1.03]"
          />
          {!product.inStock ? (
            <span className="absolute left-2 top-2 rounded-md bg-fg/90 px-2 py-1 text-xs font-semibold text-bg">
              Out of stock
            </span>
          ) : (
            <span className="absolute left-2 top-2 rounded-md bg-ok/90 px-2 py-1 text-xs font-semibold text-ok-fg">
              In stock
            </span>
          )}
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium text-accent">{product.brand}</p>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug sm:text-[15px]">{product.name}</h3>
          <p className="mt-1 text-xs text-fg/55">{product.sku}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className={cn("text-base font-semibold tabular-nums")}>{formatCurrency(product.priceAud, "AUD")}</span>
            <span className="text-xs text-fg/50">inc. GST</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
