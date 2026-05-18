import Link from "next/link";
import type { StoreTenant } from "@/lib/store/tenant-types";
import { StoreHeaderClient } from "@/components/store/store-header-client";
import { StoreHeaderNav } from "@/components/store/store-header-nav";
import { StoreLogo } from "@/components/store/store-logo";

export function StoreHeader({ tenant }: { tenant: StoreTenant }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[hsl(var(--gold)/0.16)] bg-black/92 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl pt-[max(0px,env(safe-area-inset-top))]">
      {/* Brand accent hairline */}
      <div
        className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-[hsl(var(--accent)/0.45)] to-transparent opacity-90"
        aria-hidden
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 py-3.5 sm:gap-4 sm:py-4">
          <Link
            href="/"
            className="group flex min-w-0 max-w-[min(100%,240px)] shrink-0 items-center gap-2 rounded-xl py-1 ring-1 ring-transparent transition hover:ring-[hsl(var(--gold)/0.25)] sm:max-w-none sm:gap-3"
          >
            <span className="rounded-xl bg-black p-1.5 shadow-[0_0_24px_rgba(214,174,78,0.12)] ring-1 ring-[hsl(var(--gold)/0.22)] transition group-hover:ring-[hsl(var(--gold)/0.42)]">
              <StoreLogo tenant={tenant} variant="header" priority />
            </span>
            {!tenant.logoUrl ? (
              <span className="truncate text-sm font-semibold tracking-tight text-fg sm:text-base">
                {tenant.companyName}
              </span>
            ) : null}
          </Link>

          <div className="hidden min-w-0 flex-1 md:block">
            <StoreHeaderClient />
          </div>

          <div className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] md:flex-none md:overflow-visible [&::-webkit-scrollbar]:hidden">
            <StoreHeaderNav />
          </div>
        </div>
      </div>

      <div className="border-t border-[hsl(var(--gold)/0.12)] bg-black/95 px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:hidden">
        <StoreHeaderClient />
      </div>
    </header>
  );
}
