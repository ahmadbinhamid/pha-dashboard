interface ProductEssentialsProgressProps {
  completed: number;
  total: number;
}

// "Essentials" = title, price, at least one category, at least one image —
// the fields that make a product presentable, not the strict backend-required
// set (only title/price are actually required to save).
export function ProductEssentialsProgress({ completed, total }: ProductEssentialsProgressProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-fg/45">
        {completed} of {total} essentials
      </span>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-bg-2">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
