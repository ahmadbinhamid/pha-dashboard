import { cn } from "@/lib/cn";

export function StoreSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-bg-2 ring-1 ring-border/60", className)} />;
}
