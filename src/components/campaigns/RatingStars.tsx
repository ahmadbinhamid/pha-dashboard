import { Star } from "lucide-react";
import { RATING_MAX } from "@/config/followups";
import { cn } from "@/utils/cn";

/** Read-only stars, e.g. ★★★★☆ for a 4. */
export function RatingStars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${rating} out of ${RATING_MAX}`}>
      {Array.from({ length: RATING_MAX }, (_, i) => (
        <Star key={i} className={cn("h-3.5 w-3.5", i < rating ? "fill-warn text-warn" : "text-fg/20")} />
      ))}
    </span>
  );
}
