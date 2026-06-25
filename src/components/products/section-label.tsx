interface SectionLabelProps {
  icon: React.ElementType;
  children: React.ReactNode;
}

export function SectionLabel({ icon: Icon, children }: SectionLabelProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 items-center justify-center rounded-xs bg-accent/10">
        <Icon className="h-3.5 w-3.5 text-accent" />
      </div>
      <span>{children}</span>
    </div>
  );
}
