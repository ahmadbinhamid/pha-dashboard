import Link from "@/components/ui/link";
import { Suspense, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icons } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { useOrgSettings } from "@/context";
import { cn } from "@/utils/cn";
import { useCounterCartData } from "@/context";
import { CounterCartDrawer } from "@/components/counter/counter-cart-drawer";
import { InventorySearchDialog } from "@/components/inventory/inventory-search-dialog";
import { useAuth } from "@/context/auth";

function profileInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "PH";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function Topbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { settings } = useOrgSettings();
  const initials = profileInitials(settings.displayName);
  const [cartOpen, setCartOpen] = useState(false);
  const [inventorySearchOpen, setInventorySearchOpen] = useState(false);
  const { lines } = useCounterCartData();
  const cartCount = useMemo(
    () => lines.reduce((a, l) => a + l.qty, 0),
    [lines],
  );
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleSignOut() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border/80 bg-bg/80 backdrop-blur-xl supports-backdrop-filter:bg-bg/70">
        <div
          className={cn(
            "flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8 lg:py-2.5",
            "pt-[max(0.75rem,env(safe-area-inset-top))]",
            "ps-[max(1rem,env(safe-area-inset-left))] pe-[max(1rem,env(safe-area-inset-right))]",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 shrink-0 p-0 text-fg/70 hover:bg-bg-2 lg:hidden"
              onClick={onOpenMobile}
              aria-label="Open menu"
            >
              <Icons.Bars />
            </Button>
          </div>

          <div className="hidden min-w-0 flex-1 justify-center px-2 sm:flex">
            <Button
              type="button"
              variant="secondary"
              className="h-9 w-full max-w-3xl gap-2 px-3 text-fg/80"
              onClick={() => setInventorySearchOpen(true)}
            >
              <Icons.Search className="h-4 w-4 shrink-0 text-fg/50" />
              <span className="truncate text-left text-sm">
                Search inventory, make, model, year…
              </span>
            </Button>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 w-9 shrink-0 rounded-lg p-0 sm:hidden"
              onClick={() => setInventorySearchOpen(true)}
              aria-label="Search inventory"
              title="Search inventory"
            >
              <Icons.Search className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="relative h-9 w-9 rounded-lg p-0"
              onClick={() => setCartOpen(true)}
              aria-label="Open cart"
              title="Cart"
            >
              <Icons.Cart className="h-4 w-4" />
              {cartCount ? (
                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-fg">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              ) : null}
            </Button>
            <div className="flex items-center gap-0.5 rounded-xl border border-border/60 bg-bg-2/25 p-0.5">
              <Link
                href="/settings"
                className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-bg/80"
                aria-label="Settings"
                title="Settings"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-bg text-[11px] font-semibold text-fg ring-1 ring-border/60">
                  {initials}
                </span>
              </Link>
              <span
                className="mx-0.5 hidden h-6 w-px bg-border/70 sm:block"
                aria-hidden
              />
              <div className="flex items-center pr-0.5">
                <ThemeToggle />
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="ml-1 h-9 w-9 shrink-0 rounded-lg p-0 sm:w-auto sm:px-3 sm:text-xs sm:font-semibold"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <span className="sm:hidden" aria-hidden>
                <Icons.ArrowRight className="h-4 w-4 rotate-180" />
              </span>
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <CounterCartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      <Suspense fallback={null}>
        <InventorySearchDialog
          open={inventorySearchOpen}
          onClose={() => setInventorySearchOpen(false)}
        />
      </Suspense>
    </>
  );
}
