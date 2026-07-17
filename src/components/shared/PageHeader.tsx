export function PageHeader({
  title,
  description,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-fg/55">{description}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">{children}</div> : null}
    </div>
  );
}
