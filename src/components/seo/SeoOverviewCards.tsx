import { useQuery } from "@tanstack/react-query";
import { CornerDownRight, FileText, Newspaper, SearchX } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { SEO_QUERY_KEY, getSeoOverview } from "@/lib/api/seo";
import type { SeoTab } from "@/types/seo";

/** Headline content counts; each card jumps to its tab. */
export function SeoOverviewCards({ onSelect }: { onSelect: (tab: SeoTab) => void }) {
  const { data, isLoading } = useQuery({ queryKey: [...SEO_QUERY_KEY, "overview"], queryFn: getSeoOverview });
  const o = data?.data;
  const missing = o?.products_missing_description ?? 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        size="sm"
        label="Blog articles"
        value={o ? o.articles.published : "—"}
        subLabel={o ? `${o.articles.draft} drafts · ${o.articles.scheduled} scheduled` : undefined}
        icon={<Newspaper className="h-4 w-4" />}
        loading={isLoading}
        onClick={() => onSelect("articles")}
      />
      <MetricCard
        size="sm"
        label="Pages"
        value={o ? o.pages.published : "—"}
        subLabel={o ? `${o.pages.draft} drafts` : undefined}
        icon={<FileText className="h-4 w-4" />}
        loading={isLoading}
        onClick={() => onSelect("pages")}
      />
      <MetricCard
        size="sm"
        label="Products without a description"
        value={o ? missing : "—"}
        subLabel={o ? (missing ? "Google guesses their snippet" : "All covered") : undefined}
        icon={<SearchX className="h-4 w-4" />}
        tone={missing ? "warn" : "ok"}
        loading={isLoading}
        onClick={() => onSelect("products")}
      />
      <MetricCard
        size="sm"
        label="Redirects"
        value={o ? o.redirects : "—"}
        icon={<CornerDownRight className="h-4 w-4" />}
        loading={isLoading}
        onClick={() => onSelect("redirects")}
      />
    </div>
  );
}
