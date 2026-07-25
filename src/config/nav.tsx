import {
  LayoutDashboard,
  Package,
  Layers,
  Users,
  ShoppingCart,
  Tag,
  CreditCard,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactNode;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: (p) => <LayoutDashboard {...p} /> },
  { label: "Products", href: "/products", icon: (p) => <Package {...p} /> },
  { label: "Categories", href: "/categories", icon: (p) => <Layers {...p} /> },
  { label: "Customers", href: "/customers", icon: (p) => <Users {...p} /> },
  { label: "Orders", href: "/orders", icon: (p) => <ShoppingCart {...p} /> },
  { label: "Listings", href: "/listings", icon: (p) => <Tag {...p} /> },
  { label: "Payments", href: "/payments", icon: (p) => <CreditCard {...p} /> },
];

export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
