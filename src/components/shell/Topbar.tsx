import { Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icons } from "@/components/ui/Icons";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { UserMenu } from "@/components/shell/UserMenu";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { cn } from "@/utils/cn";
import { InventorySearchDialog } from "@/components/inventory/InventorySearchDialog";
import { useCart } from "@/context/cart";
import { PackageSearch, ShoppingCart } from "lucide-react";

export function Topbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const navigate = useNavigate();
  const { totalItems } = useCart();
  const [inventorySearchOpen, setInventorySearchOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border/80 bg-bg/80 backdrop-blur-xl supports-backdrop-filter:bg-bg/70">
        <div
          className={cn(
            "flex min-h-16 items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8",
            "pt-[max(0.5rem,env(safe-area-inset-top))]",
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
              onClick={() => setPaletteOpen(true)}
            >
              <Icons.Search className="h-4 w-4 shrink-0 text-fg/50" />
              <span className="flex-1 truncate text-left text-sm">Search…</span>
              <kbd className="hidden shrink-0 rounded-xs border border-border bg-bg px-1.5 py-0.5 text-[10px] font-medium text-fg/50 sm:inline">
                ⌘K
              </kbd>
            </Button>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 w-9 shrink-0 rounded-xs p-0 sm:hidden"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search"
              title="Search"
            >
              <Icons.Search className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 w-9 shrink-0 rounded-xs p-0"
              onClick={() => setInventorySearchOpen(true)}
              aria-label="Search inventory"
              title="Search inventory (make, model, year)"
            >
              <PackageSearch className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="relative h-9 w-9 shrink-0 rounded-xs p-0"
              onClick={() => navigate("/create-order")}
              aria-label="Create order"
              title="Create Order"
            >
              <ShoppingCart className="h-4 w-4" />
              {totalItems > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-fg">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
            </Button>
            <div className="flex items-center gap-0.5 rounded-xs border border-border/60 bg-bg-2/25 p-0.5">
              <ThemeToggle />
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      <Suspense fallback={null}>
        <InventorySearchDialog
          open={inventorySearchOpen}
          onClose={() => setInventorySearchOpen(false)}
        />
      </Suspense>
    </>
  );
}
