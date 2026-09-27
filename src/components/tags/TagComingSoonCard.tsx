import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

interface TagComingSoonCardProps {
  title: string;
  description: string;
}

// Placeholder for a tag type that isn't built yet.
export function TagComingSoonCard({ title, description }: TagComingSoonCardProps) {
  return (
    <Card>
      <CardHeader title={title} right={<Badge variant="muted">Coming soon</Badge>} />
      <CardContent>
        <p className="text-sm text-fg/60">{description}</p>
      </CardContent>
    </Card>
  );
}
