
import Link from "@/components/ui/link";
import { usePathname } from "@/hooks";
import { cn } from "@/utils/cn";
import { isStoreNavActive } from "@/components/store/store-header-nav";

const ACTION_LINKS = [
  { href: "/cart", label: "Cart" },
  { href: "/account", label: "Account" },
] as const;

export function StoreHeaderActions() {
  const pathname = usePathname();

  return (
    <div className="hidden items-center gap-1 md:flex">
      {ACTION_LINKS.map(({ href, label }) => {
        const active = isStoreNavActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition",
              active
                ? "bg-accent/15 text-accent ring-1 ring-inset ring-accent/30"
                : "text-fg/70 hover:bg-white/6 hover:text-fg",
            )}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
