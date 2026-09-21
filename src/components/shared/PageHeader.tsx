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
        {/* A step smaller on phones: at 20px/14px the title block ate the top
            third of the screen before any content showed. */}
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
        {description ? <p className="mt-0.5 text-xs text-fg/55 sm:mt-1 sm:text-sm">{description}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">{children}</div> : null}
    </div>
  );
}
