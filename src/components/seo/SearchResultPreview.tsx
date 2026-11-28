import { META_LIMITS } from "@/config/seo";
import { truncate } from "@/lib/seo/seoText";

interface SearchResultPreviewProps {
  url: string;
  title: string;
  description: string;
  noindex?: boolean;
}

/** Roughly how the page appears in Google results. */
export function SearchResultPreview({ url, title, description, noindex }: SearchResultPreviewProps) {
  const crumbs = url.replace(/^https?:\/\//, "").split("/").filter(Boolean);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-fg/45">Google preview</p>
      {noindex ? (
        <p className="text-sm text-fg/60">Hidden from search engines, so it won't appear in results.</p>
      ) : (
        <div className="space-y-1">
          <p className="truncate text-xs text-fg/60">{crumbs.join(" › ")}</p>
          <p className="truncate text-lg leading-snug text-accent">{truncate(title || "Untitled", META_LIMITS.title)}</p>
          <p className="line-clamp-2 text-sm text-fg/70">
            {description ? truncate(description, META_LIMITS.description) : "Add a description so Google shows your words, not a guess."}
          </p>
        </div>
      )}
    </div>
  );
}
