export function CustomersTableSkeleton() {
  return (
    <div className="divide-y divide-border">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <div className="h-4 w-40 animate-pulse rounded-xs bg-bg-2" />
          <div className="h-4 w-24 animate-pulse rounded-xs bg-bg-2" />
          <div className="ml-auto h-4 w-10 animate-pulse rounded-xs bg-bg-2" />
        </div>
      ))}
    </div>
  );
}
