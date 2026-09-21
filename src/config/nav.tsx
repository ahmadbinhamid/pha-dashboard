import {
  LayoutDashboard,
  Package,
  Rss,
  Layers,
  Users,
  ShoppingCart,
  CreditCard,
  Boxes,
  History,
  Settings,
  BarChart2,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactNode;
  // Extra path prefixes that should also count as "this nav item is
  // active" — for a page whose own create/edit sub-routes live outside its
  // own href prefix, so the plain startsWith(href) check below wouldn't
  // highlight it on those sub-routes without this.
  activeMatch?: string[];
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: (p) => <LayoutDashboard {...p} /> },
  { label: "Products", href: "/products", icon: (p) => <Package {...p} /> },
  { label: "Listings", href: "/listings", icon: (p) => <Rss {...p} /> },
  { label: "Categories", href: "/categories", icon: (p) => <Layers {...p} /> },
  { label: "Inventory", href: "/inventory", icon: (p) => <Boxes {...p} /> },
  { label: "Customers", href: "/customers", icon: (p) => <Users {...p} /> },
  { label: "Orders", href: "/orders", icon: (p) => <ShoppingCart {...p} /> },
  { label: "Payments", href: "/payments", icon: (p) => <CreditCard {...p} /> },
  { label: "Reports", href: "/reports", icon: (p) => <BarChart2 {...p} /> },
  { label: "Activity Log", href: "/activity-log", icon: (p) => <History {...p} /> },
  { label: "Settings", href: "/settings", icon: (p) => <Settings {...p} /> },
];

export function isNavItemActive(item: Pick<NavItem, "href" | "activeMatch">, pathname: string): boolean {
  const { href, activeMatch } = item;
  if (href === "/") return pathname === "/";
  const prefixes = [href, ...(activeMatch ?? [])];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
