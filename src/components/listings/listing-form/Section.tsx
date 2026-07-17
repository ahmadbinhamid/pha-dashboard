import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { AlertCircle } from "lucide-react";

interface SectionProps {
  number: number;
  title: string;
  children: React.ReactNode;
  hasError?: boolean;
}

export function Section({ number, title, children, hasError }: SectionProps) {
  return (
    <Card className={hasError ? "ring-1 ring-danger/40" : ""}>
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <span
              className={[
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                hasError ? "bg-danger text-danger-fg" : "bg-accent text-accent-fg",
              ].join(" ")}
            >
              {number}
            </span>
            <span className="text-sm font-semibold uppercase tracking-wide">{title}</span>
            {hasError && <AlertCircle className="ml-auto h-4 w-4 text-danger" />}
          </div>
        }
      />
      <CardContent>{children}</CardContent>
    </Card>
  );
}
