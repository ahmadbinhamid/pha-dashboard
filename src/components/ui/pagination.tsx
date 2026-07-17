import { Button } from "@/components/ui/Button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
  isLoading?: boolean;
  className?: string;
}

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage = 15,
  isLoading,
  className,
}: PaginationProps) => {
  if (totalPages <= 1) return null;

  const renderPageNumbers = () => {
    const pages: (number | string)[] = [];
    const showEllipsisStart = currentPage > 3;
    const showEllipsisEnd = currentPage < totalPages - 2;

    pages.push(1);

    if (showEllipsisStart) pages.push("...");

    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      if (!pages.includes(i)) pages.push(i);
    }

    if (showEllipsisEnd) pages.push("...");

    if (totalPages > 1 && !pages.includes(totalPages)) pages.push(totalPages);

    return pages;
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between border-t border-border px-5 py-3",
        className,
      )}
    >
      <p className="text-xs tabular-nums text-fg/50">
        {typeof totalItems === "number" ? (
          <>
            Showing{" "}
            <span className="font-medium text-fg/70">
              {totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
            </span>
            {"–"}
            <span className="font-medium text-fg/70">
              {Math.min(currentPage * itemsPerPage, totalItems)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-fg/70">{totalItems}</span>
          </>
        ) : (
          <>
            Page{" "}
            <span className="font-medium text-fg/70">{currentPage}</span>{" "}
            of{" "}
            <span className="font-medium text-fg/70">{totalPages}</span>
          </>
        )}
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || isLoading}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-0.5">
          {renderPageNumbers().map((page, index) => {
            if (page === "...") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-xs text-fg/40"
                >
                  …
                </span>
              );
            }

            const pageNumber = page as number;
            const isActive = pageNumber === currentPage;

            return (
              <button
                key={pageNumber}
                type="button"
                onClick={() => onPageChange(pageNumber)}
                className={cn(
                  "flex h-8 min-w-8 items-center justify-center rounded-xs px-1.5 text-xs font-medium transition",
                  isActive
                    ? "bg-accent text-accent-fg"
                    : "text-fg/60 hover:bg-bg-2",
                )}
              >
                {pageNumber}
              </button>
            );
          })}
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || isLoading}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

Pagination.displayName = "Pagination";

export { Pagination };
export type { PaginationProps };
