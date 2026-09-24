import { Skeleton } from "@/components/ui/Skeleton";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-3 text-2xs font-semibold uppercase tracking-wider text-fg/40 first:pt-1">
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

// Heading + results/skeleton/error group shared by CommandPalette sections.
export function CommandPaletteSection<T>({
  heading,
  total,
  isLoading,
  isError,
  items,
  renderItem,
}: {
  heading: string;
  // "heading (total)" once known; omitted in flight so it never claims zero.
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
