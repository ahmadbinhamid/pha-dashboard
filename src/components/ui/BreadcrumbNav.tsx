import * as React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function BreadcrumbNav({ items, className }: BreadcrumbNavProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1 text-xs text-fg/50", className)}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <ChevronRight className="h-3 w-3 shrink-0 text-fg/30" aria-hidden />
            )}
            {isLast || !item.href ? (
              <span
                className={cn(
                  "min-w-0 truncate",
                  isLast ? "font-medium text-fg" : "shrink hover:text-fg transition",
                )}
              >
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href}
                className="min-w-0 shrink truncate transition hover:text-fg"
              >
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
