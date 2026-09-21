import { Skeleton } from "@/components/ui/Skeleton";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-fg/40 first:pt-1">
      {children}
    </div>
  );
}

function SearchUnavailableRow() {
  return <p className="px-2.5 py-2 text-xs text-danger">Search is temporarily unavailable — try again shortly.</p>;
}

function ResultSkeletonRows() {
  return (
    <div className="space-y-1 px-2.5 py-1">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-3 py-1.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-2.5 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// One "PRODUCTS (5) / results-or-skeleton-or-error" group, shared by every
// result section in CommandPalette — collapses what used to be three
// (soon four) near-identical heading+loading+error+list blocks inline in
// CommandPalette.tsx into one place.
export function CommandPaletteSection<T>({
  heading,
  total,
  isLoading,
  isError,
  items,
  renderItem,
}: {
  heading: string;
  // Shown as "heading (total)" once known — omitted (not "(0)") while the
  // request is still in flight, so a section never claims zero results
  // before it's actually checked.
  total?: number;
  isLoading: boolean;
  isError: boolean;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}) {
  return (
    <div>
      <SectionHeading>
        {heading}
        {typeof total === "number" ? ` (${total})` : ""}
      </SectionHeading>
      {isError ? <SearchUnavailableRow /> : isLoading ? <ResultSkeletonRows /> : items.map(renderItem)}
    </div>
  );
}
