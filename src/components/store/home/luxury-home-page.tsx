import type { StoreProduct } from "@/lib/store/data/catalog";
import { LuxuryHero } from "@/components/store/home/luxury-hero";
import { LuxuryCategories } from "@/components/store/home/luxury-categories";
import { LuxuryTrustRow } from "@/components/store/home/luxury-trust-row";
import { LuxuryFeaturedProducts } from "@/components/store/home/luxury-featured-products";
import { LuxuryBrandMarquee } from "@/components/store/home/luxury-brand-marquee";
import { LuxuryPromoSliders } from "@/components/store/home/luxury-promo-sliders";
import { LuxuryWhyUs } from "@/components/store/home/luxury-why-us";

export function LuxuryHomePage({ featuredProducts }: { featuredProducts: StoreProduct[] }) {
  return (
    <>
      <LuxuryHero />
      <LuxuryCategories />
      <LuxuryTrustRow />
      <LuxuryFeaturedProducts products={featuredProducts} />
      <LuxuryBrandMarquee />
      <LuxuryPromoSliders />
      <LuxuryWhyUs />
    </>
  );
}
