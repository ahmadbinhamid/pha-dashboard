"use client";

import Link from "next/link";
import type { StoreTenant } from "@/lib/store/tenant-types";
import { StoreLogo } from "@/components/store/store-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/toast/toast-provider";

export function StoreFooter({ tenant }: { tenant: StoreTenant }) {
  const { toast } = useToast();

  return (
    <footer className="mt-auto border-t border-[hsl(var(--gold)/0.16)] bg-black pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            {tenant.logoUrl ? (
              <div className="mb-4 inline-flex rounded-xl bg-black p-1.5 ring-1 ring-[hsl(var(--gold)/0.2)]">
                <StoreLogo tenant={tenant} variant="footer" />
              </div>
            ) : null}
            <p className="text-sm font-semibold text-fg">{tenant.companyName}</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-fg/55">{tenant.tagline}</p>
            <div className="mt-6 flex gap-3">
              <a
                href="#"
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-fg/70 transition hover:border-accent/40 hover:text-fg"
                aria-label="LinkedIn"
              >
                in
              </a>
              <a
                href="#"
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-fg/70 transition hover:border-accent/40 hover:text-fg"
                aria-label="Instagram"
              >
                ig
              </a>
              <a
                href="#"
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-fg/70 transition hover:border-accent/40 hover:text-fg"
                aria-label="Facebook"
              >
                fb
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 max-[380px]:grid-cols-1 sm:grid-cols-3 sm:gap-10 lg:col-span-5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-gold/90">Shop</div>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <Link href="/parts" className="text-fg/65 transition hover:text-accent">
                    All parts
                  </Link>
                </li>
                <li>
                  <Link href="/brands" className="text-fg/65 transition hover:text-accent">
                    Brands
                  </Link>
                </li>
                <li>
                  <Link href="/search" className="text-fg/65 transition hover:text-accent">
                    Search
                  </Link>
                </li>
                <li>
                  <Link href="/cart" className="text-fg/65 transition hover:text-accent">
                    Cart
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-gold/90">Categories</div>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <Link href="/parts?brand=Mercedes-Benz" className="text-fg/65 transition hover:text-accent">
                    Mercedes-Benz
                  </Link>
                </li>
                <li>
                  <Link href="/parts?brand=BMW" className="text-fg/65 transition hover:text-accent">
                    BMW
                  </Link>
                </li>
                <li>
                  <Link href="/parts?brand=Audi" className="text-fg/65 transition hover:text-accent">
                    Audi
                  </Link>
                </li>
                <li>
                  <Link href="/parts?brand=Porsche" className="text-fg/65 transition hover:text-accent">
                    Porsche
                  </Link>
                </li>
              </ul>
            </div>
            <div className="max-[380px]:col-span-1 col-span-2 sm:col-span-1">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-gold/90">Company</div>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <Link href="/about" className="text-fg/65 transition hover:text-accent">
                    About us
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-fg/65 transition hover:text-accent">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="/account" className="text-fg/65 transition hover:text-accent">
                    Account
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-gold/90">Newsletter</div>
            <p className="mt-4 text-sm text-fg/55">Restocks, performance drops, and workshop tips — monthly at most.</p>
            <form
              className="mt-4 flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                toast({ tone: "success", title: "Subscribed (demo)", description: "Wire to your ESP later." });
              }}
            >
              <Input
                type="email"
                required
                placeholder="Email address"
                className="border-white/10 bg-surface text-fg placeholder:text-fg/40"
              />
              <Button type="submit" className="shrink-0">
                Join
              </Button>
            </form>
            <div className="mt-8 space-y-1 text-sm text-fg/55">
              <p>{tenant.supportEmail}</p>
              <p>{tenant.supportPhone}</p>
              <p className="text-xs text-fg/45">{tenant.defaultWarehouse}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-[11px] text-fg/45" suppressHydrationWarning>
        © {new Date().getFullYear()} {tenant.companyName}. Prices include GST where applicable ({tenant.currency}).
      </div>
    </footer>
  );
}
