import { getHomeFeaturedProducts } from "@/lib/store/data/home-mock";
import { LuxuryHomePage } from "@/components/store/home/luxury-home-page";

export default function StoreHomePage() {
  const featuredProducts = getHomeFeaturedProducts();
  return <LuxuryHomePage featuredProducts={featuredProducts} />;
}
