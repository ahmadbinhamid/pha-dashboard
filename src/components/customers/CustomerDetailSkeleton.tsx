import { Skeleton } from "@/components/ui/Skeleton";

export function CustomerDetailSkeleton() {
  return (
    <div className="space-y-5 pb-24">
      <Skeleton className="h-3 w-32" />
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="rounded-xs border border-border bg-card p-5 space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
        <div className="rounded-xs border border-border bg-card p-5 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}
