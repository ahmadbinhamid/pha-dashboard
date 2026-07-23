import { Icons } from "@/components/ui/Icons";

export type NavItem = {
  label: string;
  href: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactNode;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Icons.Home },
  { label: "Products", href: "/products", icon: Icons.Package },
  { label: "Categories", href: "/categories", icon: Icons.Layers },
  // { label: "Inventory", href: "/inventory", icon: Icons.Box },
  { label: "Customers", href: "/customers", icon: Icons.Users },
  { label: "Orders", href: "/orders", icon: Icons.Cart },
  { label: "Listings", href: "/listings", icon: Icons.Tag },
  { label: "Payments", href: "/payments", icon: Icons.CreditCard },
  // { label: "Analytics", href: "/analytics", icon: Icons.Chart },
  // { label: "Suppliers", href: "/suppliers", icon: Icons.Truck },
  // { label: "Reports", href: "/reports", icon: Icons.Layers },
  // { label: "eBay Uploader", href: "/tools/ebay-uploader", icon: Icons.Upload },
  // { label: "Settings", href: "/settings", icon: Icons.Settings },
];

export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
