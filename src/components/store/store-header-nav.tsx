"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  /** Hide below this breakpoint: sm | md | lg | none */
  hideBelow?: "sm" | "md" | "lg";
};

const NAV: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/parts", label: "Parts" },
  { href: "/brands", label: "Brands", hideBelow: "sm" },
  { href: "/contact", label: "Contact", hideBelow: "lg" },
  { href: "/cart", label: "Cart" },
  { href: "/account", label: "Account" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/parts") return pathname === "/parts" || pathname.startsWith("/parts/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function hideClass(breakpoint?: NavItem["hideBelow"]) {
  if (!breakpoint) return "";
  if (breakpoint === "sm") return "hidden sm:block";
  if (breakpoint === "md") return "hidden md:block";
  return "hidden lg:block";
}

export function StoreHeaderNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex w-max min-w-0 flex-nowrap items-center gap-0.5 sm:gap-1"
      aria-label="Store"
    >
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative whitespace-nowrap rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors sm:px-3 sm:py-2",
              hideClass(item.hideBelow),
              active
                ? "bg-accent/15 text-accent ring-1 ring-inset ring-accent/40"
                : "text-fg/65 hover:bg-white/5 hover:text-fg",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
