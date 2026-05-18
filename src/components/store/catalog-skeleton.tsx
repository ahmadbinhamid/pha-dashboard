import { StoreSkeleton } from "@/components/store/ui/skeleton";

export function CatalogSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <StoreSkeleton className="h-9 w-64" />
      <StoreSkeleton className="mt-2 h-4 w-full max-w-xl" />
      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
        <StoreSkeleton className="h-[520px] w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <StoreSkeleton key={i} className="h-[320px] w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
