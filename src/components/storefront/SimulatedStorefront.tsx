import { useState } from "react";
import { Lock, Menu, RotateCcw, Search, ShieldCheck, ShoppingCart, Truck } from "lucide-react";
import { TenantLogo } from "@/components/branding/TenantLogo";
import { AnnouncementStrip } from "@/components/storefront/AnnouncementStrip";
import { SaleTicker } from "@/components/storefront/SaleTicker";
import { SimulatorHeroSlider } from "@/components/storefront/SimulatorHeroSlider";
import { SimulatorProductCard } from "@/components/storefront/SimulatorProductCard";
import { isProductOnSale } from "@/lib/storefront/salePricing";
import type { Category, Product } from "@/types/product";
import type { StorefrontPreviewContent } from "@/types/storefront";

const TRUST_BADGES = [
  { icon: Truck, title: "Same-day dispatch", text: "Order before 2PM" },
  { icon: ShieldCheck, title: "Quality checked", text: "Every part inspected" },
  { icon: RotateCcw, title: "30-day returns", text: "Hassle-free" },
  { icon: Lock, title: "Secure checkout", text: "Stripe protected" },
];

const NAV_CATEGORY_LIMIT = 5;

interface SimulatedStorefrontProps {
  content: StorefrontPreviewContent;
  // Phone preview: hero slides use their phone photo when set.
  mobile?: boolean;
  storeName: string;
  logoUrl: string | null;
  host: string;
  categories: Category[];
  products: Product[];
}

// Root is a size container, children use @-queries, not viewport breakpoints.
export function SimulatedStorefront({ content, mobile = false, storeName, logoUrl, host, categories, products }: SimulatedStorefrontProps) {
  const [cartCount, setCartCount] = useState(0);
  const { slides, heroSettings, announcement, sale } = content;
  const navCategories = categories.filter((c) => !c.parent).slice(0, NAV_CATEGORY_LIMIT);
  const activeSlides = slides.filter((s) => s.active);

  return (
    <div className="@container flex h-full flex-col bg-bg font-store text-fg">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-bg-2 px-3 py-2">
        <div className="hidden gap-1.5 @3xl:flex">
          <span className="h-2.5 w-2.5 rounded-full bg-danger" />
          <span className="h-2.5 w-2.5 rounded-full bg-warn" />
          <span className="h-2.5 w-2.5 rounded-full bg-ok" />
        </div>
        <div className="mx-auto flex w-full max-w-md min-w-0 items-center justify-center gap-1.5 rounded-md bg-card px-3 py-1 text-2xs text-fg/60 ring-1 ring-inset ring-border">
          <Lock className="h-3 w-3 shrink-0 text-ok" />
          <span className="truncate">{host}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {announcement.enabled && announcement.message ? <AnnouncementStrip announcement={announcement} /> : null}

        <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-card px-4 py-3 @3xl:px-8">
          <Menu className="h-5 w-5 shrink-0 @3xl:hidden" />
          <div className="flex min-w-0 items-center gap-2">
            <TenantLogo logoUrl={logoUrl} name={storeName} sizeClass="h-7" maxWidthClass="max-w-32" />
            <span className="truncate text-sm font-bold">{storeName || "Your store"}</span>
          </div>
          <nav className="hidden flex-1 items-center gap-5 text-xs font-medium text-fg/70 @3xl:flex">
            {navCategories.map((c) => (
              <span key={c._id} className="truncate">
                {c.name}
              </span>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <Search className="h-4.5 w-4.5 text-fg/70" />
            <div className="relative">
              <ShoppingCart className="h-4.5 w-4.5 text-fg/70" />
              {cartCount > 0 ? (
                <span className="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-4xs font-bold text-accent-fg">
                  {cartCount}
                </span>
              ) : null}
            </div>
          </div>
        </header>

        <SimulatorHeroSlider slides={activeSlides} settings={heroSettings} mobile={mobile} />
        {sale ? <SaleTicker sale={sale} /> : null}

        <section className="grid grid-cols-2 gap-3 border-b border-border px-4 py-4 @3xl:grid-cols-4 @3xl:px-8">
          {TRUST_BADGES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-2xs font-semibold">{title}</p>
                <p className="truncate text-3xs text-fg/55">{text}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="px-4 py-6 @3xl:px-8">
          <h3 className="mb-3 text-sm font-bold @3xl:text-base">Featured parts</h3>
          {products.length ? (
            <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3 @5xl:grid-cols-4">
              {products.map((p) => (
                <SimulatorProductCard
                  key={p._id}
                  product={p}
                  sale={sale?.show_product_badges && isProductOnSale(p, sale) ? sale : null}
                  onAdd={() => setCartCount((n) => n + 1)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border py-8 text-center text-xs text-fg/50">
              Published products appear here.
            </p>
          )}
        </section>

        <footer className="border-t border-border bg-bg-2 px-4 py-4 text-center text-3xs text-fg/50">
          © {new Date().getFullYear()} {storeName || "Your store"}
        </footer>
      </div>
    </div>
  );
}
