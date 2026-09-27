
import Link from "@/components/ui/Link";
import { usePathname } from "@/hooks";
import { isNavItemActive, visibleNavItems } from "@/config/nav";
import { useMyAccess } from "@/hooks/useMyAccess";
import { erpNavIconClass, erpNavRowClass } from "@/config/navStyles";

export function NavItemsList({
  collapsed = false,
  onItemClick,
}: {
  collapsed?: boolean;
  onItemClick?: () => void;
}) {
  const pathname = usePathname();
  const { can } = useMyAccess();

  return (
    <ul className="space-y-0.5">
      {visibleNavItems(can).map((item) => {
        const active = isNavItemActive(item, pathname);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              title={item.label}
              onClick={onItemClick}
              className={erpNavRowClass(active, collapsed)}
            >
              <span className={erpNavIconClass(active)} aria-hidden="true">
                {item.icon({ className: "h-[15px] w-[15px]" })}
              </span>
              {!collapsed ? (
                <span className="min-w-0 truncate pr-1">{item.label}</span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
