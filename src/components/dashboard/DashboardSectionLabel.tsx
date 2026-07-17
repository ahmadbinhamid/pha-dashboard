export function DashboardSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-3 w-[3px] rounded-xs bg-accent" aria-hidden="true" />
      <h3 className="text-xs font-semibold uppercase tracking-wider text-fg/60">{children}</h3>
    </div>
  );
}
