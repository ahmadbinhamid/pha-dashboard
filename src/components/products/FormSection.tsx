import { Card, CardHeader, CardContent } from "@/components/ui/Card";

interface FormSectionProps {
  number: number;
  title: string;
  description?: React.ReactNode;
  tag?: React.ReactNode;
  contentClassName?: string;
  children: React.ReactNode;
}

// Numbered section wrapper shared by the product create/edit forms — the
// number chip is what distinguishes this from the plain icon-badge SectionLabel
// used elsewhere, matching the step-like "1 Basics / 2 Classification…" layout.
export function FormSection({
  number,
  title,
  description,
  tag,
  contentClassName,
  children,
}: FormSectionProps) {
  return (
    <Card>
      <CardHeader
        title={
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10 text-xs font-bold text-accent">
              {number}
            </span>
            <span className="text-base font-semibold text-fg">{title}</span>
          </div>
        }
        description={description}
        right={tag}
      />
      <CardContent className={contentClassName ?? "space-y-4"}>{children}</CardContent>
    </Card>
  );
}
