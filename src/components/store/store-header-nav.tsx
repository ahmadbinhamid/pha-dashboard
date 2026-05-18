"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type StoreNavItem = {
  href: string;
  label: string;
};

export const STORE_NAV: StoreNavItem[] = [
  { href: "/", label: "Home" },
  { href: "/parts", label: "Parts" },
  { href: "/brands", label: "Brands" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/cart", label: "Cart" },
  { href: "/account", label: "Account" },
];

export function isStoreNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/parts") return pathname === "/parts" || pathname.startsWith("/parts/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop horizontal nav — hidden below md */
export function StoreHeaderNav() {
  const pathname = usePathname();

  const desktopItems: StoreNavItem[] = [
    { href: "/parts", label: "Parts" },
    { href: "/brands", label: "Brands" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <nav
      className="hidden items-center gap-0.5 md:flex"
      aria-label="Main navigation"
    >
      {desktopItems.map((item) => {
        const active = isStoreNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent/15 text-accent ring-1 ring-inset ring-accent/30"
                : "text-fg/70 hover:bg-white/6 hover:text-fg",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
