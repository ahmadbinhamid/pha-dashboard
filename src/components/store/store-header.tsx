import { Suspense } from "react";
import Link from "@/components/ui/link";
import type { StoreTenant } from "@/types";
import { StoreHeaderClient } from "@/components/store/store-header-client";
import { StoreHeaderNav } from "@/components/store/store-header-nav";
import { StoreHeaderActions } from "@/components/store/store-header-actions";
import { StoreLogo } from "@/components/store/store-logo";
import { StoreMobileMenu } from "@/components/store/store-mobile-menu";

export function StoreHeader({ tenant }: { tenant: StoreTenant }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[hsl(var(--gold)/0.16)] bg-black/92 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      {/* Brand accent hairline */}
      <div
        className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-[hsl(var(--accent)/0.45)] to-transparent"
        aria-hidden
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[4rem] items-center gap-3 sm:gap-4">

          {/* Logo */}
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2 rounded-xl py-1 ring-1 ring-transparent transition hover:ring-[hsl(var(--gold)/0.25)] sm:gap-2.5"
            aria-label={tenant.companyName}
          >
            <span className="rounded-xl bg-black p-1 shadow-[0_0_20px_rgba(214,174,78,0.1)] ring-1 ring-[hsl(var(--gold)/0.22)] transition group-hover:ring-[hsl(var(--gold)/0.4)]">
              <StoreLogo tenant={tenant} variant="header" priority />
            </span>
          </Link>

          {/* Desktop search */}
          <div className="hidden min-w-0 flex-1 md:block">
            <StoreHeaderClient />
          </div>

          {/* Desktop nav */}
          <Suspense fallback={<nav className="hidden items-center gap-0.5 md:flex" />}>
            <StoreHeaderNav />
          </Suspense>

          {/* Desktop action links */}
          <Suspense fallback={<div className="hidden items-center gap-1 md:flex" />}>
            <StoreHeaderActions />
          </Suspense>

          {/* Mobile right side: search icon + hamburger */}
          <div className="ml-auto flex items-center gap-1 md:hidden">
            <Link
              href="/cart"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-fg/70 transition hover:bg-white/8 hover:text-fg"
              aria-label="Cart"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
                <path d="M6 6h15l-2 9H7L6 6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M6 6 5 3H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="9" cy="20" r="1" fill="currentColor"/>
                <circle cx="17" cy="20" r="1" fill="currentColor"/>
              </svg>
            </Link>
            <StoreMobileMenu tenant={tenant} />
          </div>

        </div>
      </div>

      {/* Mobile search — always visible below header row on small screens */}
      <div className="border-t border-[hsl(var(--gold)/0.1)] px-4 pb-2.5 pt-2 md:hidden">
        <StoreHeaderClient />
      </div>
    </header>
  );
}
