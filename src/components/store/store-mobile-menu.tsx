
import Link from "@/components/ui/link";
import { usePathname } from "@/hooks";
import { useEffect, useState } from "react";
import type { StoreTenant } from "@/types";
import { STORE_NAV, isStoreNavActive } from "@/components/store/store-header-nav";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";

export function StoreMobileMenu({ tenant }: { tenant: StoreTenant }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      {/* Hamburger button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="h-10 w-10 rounded-lg p-0 text-fg/70 hover:bg-white/8 hover:text-fg"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        )}
      </Button>

      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden
        onClick={() => setOpen(false)}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[min(80vw,320px)] flex-col border-l border-[hsl(var(--gold)/0.16)] bg-luxury-ink shadow-2xl transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--gold)/0.12)] px-5 py-4">
          <span className="text-sm font-semibold text-fg">{tenant.companyName}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            className="h-9 w-9 rounded-lg p-0 text-fg/60 hover:bg-white/8 hover:text-fg"
            aria-label="Close menu"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </Button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-4 py-4" aria-label="Mobile navigation">
          <ul className="space-y-1">
            {STORE_NAV.map((item) => {
              const active = isStoreNavActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent/15 text-accent ring-1 ring-inset ring-accent/30"
                        : "text-fg/75 hover:bg-white/6 hover:text-fg",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-[hsl(var(--gold)/0.12)] px-5 py-4 text-xs text-fg/40">
          {tenant.supportEmail} &bull; {tenant.supportPhone}
        </div>
      </div>
    </>
  );
}
