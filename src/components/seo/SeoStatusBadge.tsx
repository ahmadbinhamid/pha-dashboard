import { Badge } from "@/components/ui/Badge";
import { META_LIMITS } from "@/config/seo";
import type { SeoMeta } from "@/types/seo";

/** Whether a product or category is ready for search, at a glance. */
export function SeoStatusBadge({ seo }: { seo: SeoMeta }) {
  if (seo.noindex) return <Badge variant="muted">Hidden from Google</Badge>;
  if (!seo.meta_description) return <Badge variant="warn">No description</Badge>;
  if (seo.meta_description.length > META_LIMITS.description) return <Badge variant="warn">Description too long</Badge>;
  return <Badge variant="ok">Ready</Badge>;
}
