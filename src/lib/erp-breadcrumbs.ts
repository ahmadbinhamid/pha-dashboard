/**
 * Breadcrumb trail for the ERP app shell — keeps every screen anchored to Dashboard.
 */
import { INVENTORY } from "@/lib/data/inventory";

export type ErpCrumb = { label: string; href: string };

export function getErpBreadcrumbs(pathname: string): ErpCrumb[] {
  if (pathname === "/dashboard") {
    return [{ label: "Dashboard", href: "/dashboard" }];
  }

  const base: ErpCrumb[] = [{ label: "Dashboard", href: "/dashboard" }];

  if (pathname.startsWith("/inventory/new")) {
    return [...base, { label: "Inventory", href: "/inventory" }, { label: "Add product", href: "/inventory/new" }];
  }
  if (pathname.startsWith("/inventory/bundles")) {
    return [...base, { label: "Inventory", href: "/inventory" }, { label: "Bundles", href: "/inventory/bundles" }];
  }
  if (pathname.startsWith("/inventory")) {
    return [...base, { label: "Inventory", href: "/inventory" }];
  }

  if (pathname.startsWith("/orders/new")) {
    return [...base, { label: "Orders", href: "/orders" }, { label: "Create order", href: "/orders/new" }];
  }
  if (pathname.startsWith("/orders")) {
    return [...base, { label: "Orders", href: "/orders" }];
  }

  if (pathname.startsWith("/listings")) {
    return [...base, { label: "Listings", href: "/listings" }];
  }
  if (pathname.startsWith("/analytics")) {
    return [...base, { label: "Analytics", href: "/analytics" }];
  }
  if (pathname.startsWith("/customers")) {
    return [...base, { label: "Customers", href: "/customers" }];
  }
  if (pathname.startsWith("/suppliers")) {
    return [...base, { label: "Suppliers", href: "/suppliers" }];
  }
  if (pathname.startsWith("/reports")) {
    return [...base, { label: "Reports", href: "/reports" }];
  }
  if (pathname.startsWith("/settings")) {
    return [...base, { label: "Settings", href: "/settings" }];
  }

  if (pathname.startsWith("/products/")) {
    const id = pathname.replace(/^\/products\//, "").split("/")[0] ?? "";
    const p = INVENTORY.find((x) => x.id === id);
    return [
      ...base,
      { label: "Inventory", href: "/inventory" },
      { label: p ? p.title : "Product", href: pathname },
    ];
  }

  return [{ label: "Workspace", href: "/dashboard" }];
}
