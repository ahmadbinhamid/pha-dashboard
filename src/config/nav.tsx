import {
  LayoutDashboard,
  Package,
  RefreshCw,
  Layers,
  Users,
  ShoppingCart,
  CreditCard,
  Boxes,
  History,
  Settings,
  BarChart2,
  Tags,
} from "lucide-react";
import { PERMISSIONS, type Permission } from "@/config/permissions";

export type NavItem = {
  label: string;
  href: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactNode;
  // Extra active-path prefixes for create/edit routes outside the page's href.
  activeMatch?: string[];
  // Omitted when the page gates its own contents (Settings tabs).
  permission?: Permission;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: (p) => <LayoutDashboard {...p} />, permission: PERMISSIONS.dashboard.view },
  { label: "Products", href: "/products", icon: (p) => <Package {...p} />, permission: PERMISSIONS.products.view },
  { label: "Categories", href: "/categories", icon: (p) => <Layers {...p} />, permission: PERMISSIONS.categories.view },
  { label: "Inventory", href: "/inventory", icon: (p) => <Boxes {...p} />, permission: PERMISSIONS.inventory.view },
  { label: "Tag manager", href: "/tags", icon: (p) => <Tags {...p} />, permission: PERMISSIONS.tags.view },
  { label: "Customers", href: "/customers", icon: (p) => <Users {...p} />, permission: PERMISSIONS.customers.view },
  { label: "Orders", href: "/orders", icon: (p) => <ShoppingCart {...p} />, permission: PERMISSIONS.orders.view },
  { label: "Payments", href: "/payments", icon: (p) => <CreditCard {...p} />, permission: PERMISSIONS.payments.view },
  { label: "Reports", href: "/reports", icon: (p) => <BarChart2 {...p} />, permission: PERMISSIONS.reports.view },
  { label: "Channel sync", href: "/channel-sync", icon: (p) => <RefreshCw {...p} />, permission: PERMISSIONS.listings.view },
  { label: "Activity Log", href: "/activity-log", icon: (p) => <History {...p} />, permission: PERMISSIONS.activity.view },
  { label: "Settings", href: "/settings", icon: (p) => <Settings {...p} /> },
];

/** Nav items the user may open, given useMyAccess().can. */
export function visibleNavItems(can: (permission: Permission) => boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.permission || can(item.permission));
}

export function isNavItemActive(item: Pick<NavItem, "href" | "activeMatch">, pathname: string): boolean {
  const { href, activeMatch } = item;
  if (href === "/") return pathname === "/";
  const prefixes = [href, ...(activeMatch ?? [])];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
