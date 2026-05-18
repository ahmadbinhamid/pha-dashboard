import { CATALOG, type StoreProduct } from "@/lib/store/data/catalog";

export const HOME_FEATURED_SLUGS = [
  "mercedes-gle-front-brake-pads-w167",
  "bmw-x5-led-headlight-assembly-g05",
  "audi-rsq8-front-grille-oem",
  "porsche-cayenne-air-suspension-kit-9y0",
  "mercedes-oem-front-brake-pads-w205",
  "bmw-oil-filter-n20-n26",
  "audi-air-filter-b9-2-0tfsi",
  "porsche-cayenne-front-sway-link",
] as const;

export function getHomeFeaturedProducts(): StoreProduct[] {
  const map = new Map(CATALOG.map((p) => [p.slug, p]));
  return HOME_FEATURED_SLUGS.map((s) => map.get(s)).filter(Boolean) as StoreProduct[];
}

export type LuxuryCategoryCard = {
  slug: string;
  title: string;
  subtitle: string;
  href: string;
  image: string;
};

export const LUXURY_CATEGORY_CARDS: LuxuryCategoryCard[] = [
  {
    slug: "mercedes",
    title: "Mercedes-Benz",
    subtitle: "OEM & AMG performance",
    href: "/parts?brand=Mercedes-Benz",
    image: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1200&q=85",
  },
  {
    slug: "bmw-m",
    title: "BMW M Performance",
    subtitle: " ///M parts & upgrades",
    href: "/parts?brand=BMW",
    image: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1200&q=85",
  },
  {
    slug: "audi-rs",
    title: "Audi RS",
    subtitle: "RS & S lineage",
    href: "/parts?brand=Audi",
    image: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=1200&q=85",
  },
  {
    slug: "porsche",
    title: "Porsche",
    subtitle: "Genuine & performance",
    href: "/parts?brand=Porsche",
    image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&q=85",
  },
  {
    slug: "range-rover",
    title: "Range Rover",
    subtitle: "OEM luxury SUV",
    href: "/parts?q=Range+Rover",
    image: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=1200&q=85",
  },
  {
    slug: "vag",
    title: "Volkswagen Group",
    subtitle: "VW · Audi · Škoda",
    href: "/parts?brand=Volkswagen",
    image: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=1200&q=85",
  },
];

export const VEHICLE_SEARCH = {
  makes: ["Mercedes-Benz", "BMW", "Audi", "Porsche", "Volkswagen", "Toyota", "Lexus", "Land Rover"],
  modelsByMake: {
    "Mercedes-Benz": ["C-Class", "E-Class", "GLE", "G-Class", "S-Class"],
    BMW: ["3 Series", "5 Series", "X5", "X3", "M3", "M4"],
    Audi: ["A4", "A6", "Q5", "Q7", "RS Q8", "RS6"],
    Porsche: ["911", "Cayenne", "Macan", "Panamera"],
    Volkswagen: ["Golf", "Tiguan", "Amarok"],
    Toyota: ["LandCruiser", "HiLux", "Prado"],
    Lexus: ["RX", "NX", "IS"],
    "Land Rover": ["Range Rover", "Range Rover Sport", "Discovery", "Defender"],
  } as Record<string, string[]>,
  years: Array.from({ length: 25 }, (_, i) => String(2025 - i)),
  partCategories: ["Brakes", "Engine", "Filters", "Suspension", "Electrical", "Body", "Service kits"],
};

export const TRUST_PILLARS = [
  { title: "Genuine OEM parts", description: "Sourced & verified" },
  { title: "Australia-wide shipping", description: "Tracked dispatch" },
  { title: "Warranty support", description: "On eligible lines" },
  { title: "Trusted supplier", description: "Workshop partners" },
  { title: "Secure checkout", description: "PCI-ready path" },
] as const;

export const WHY_CHOOSE_US = [
  {
    title: "15+ years",
    subtitle: "European parts expertise",
    body: "Specialist sourcing for German & prestige marques.",
  },
  {
    title: "50k+ lines",
    subtitle: "Warehouse inventory",
    body: "Multi-site stock with live availability (ERP-connected soon).",
  },
  {
    title: "Genuine guarantee",
    subtitle: "Condition disclosed",
    body: "New, OEM, and inspected used — clearly labelled.",
  },
  {
    title: "Fast dispatch",
    subtitle: "Same-day cut-offs",
    body: "Metro express options from Campbellfield & partner DCs.",
  },
] as const;

export const MARQUEE_BRANDS = [
  "Mercedes-Benz",
  "BMW",
  "Audi",
  "Porsche",
  "Range Rover",
  "Volkswagen",
  "Lexus",
] as const;

export type PromoSlide = {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  image: string;
};

export const PROMO_SLIDES: PromoSlide[] = [
  {
    id: "suv",
    title: "Luxury SUVs",
    subtitle: "G-Wagon · X5 · RS Q8 — body, suspension & service parts",
    cta: "Explore SUV parts",
    href: "/parts?q=SUV",
    image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=1600&q=85",
  },
  {
    id: "performance",
    title: "Performance lineage",
    subtitle: "AMG · BMW M · Audi RS — brakes, intake & more",
    cta: "Shop performance",
    href: "/parts?q=performance",
    image: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1600&q=85",
  },
  {
    id: "logistics",
    title: "Warehouse precision",
    subtitle: "National fulfilment · Campbellfield HQ",
    cta: "How we ship",
    href: "/about",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1600&q=85",
  },
];
