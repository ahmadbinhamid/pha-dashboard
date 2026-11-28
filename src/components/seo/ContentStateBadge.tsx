import { Badge } from "@/components/ui/Badge";
import { CONTENT_STATE_BADGE } from "@/config/seo";
import type { ContentState } from "@/types/seo";

export function ContentStateBadge({ state }: { state: ContentState }) {
  const { label, variant } = CONTENT_STATE_BADGE[state];
  return <Badge variant={variant}>{label}</Badge>;
}
