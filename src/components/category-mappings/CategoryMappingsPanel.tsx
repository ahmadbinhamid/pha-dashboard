import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { CategoryMappingRow } from "@/components/category-mappings/CategoryMappingRow";
import { getCategoryMappingOverview } from "@/lib/api/categoryMappings";
import type { CategoryMapping } from "@/types/categoryMapping";

// Settings > Integrations > Channel Categories: each product category's default channel category.
// A listing uses its own category if set, else this default (see categoryMapping.service.js).
export function CategoryMappingsPanel() {
  const { data, isLoading } = useQuery({ queryKey: ["category-mappings"], queryFn: getCategoryMappingOverview });
  const overview = data?.data;

  if (isLoading || !overview) return <SkeletonCard />;

  const byCategory = new Map<string, Record<string, CategoryMapping>>();
  for (const m of overview.mappings) {
    const row = byCategory.get(m.product_category_id) ?? {};
    row[m.platform] = m;
    byCategory.set(m.product_category_id, row);
  }

  return (
    <Card>
      <CardHeader
        title="Default channel categories"
        description="eBay and Google use unrelated category systems, so map each of your product categories once. New listings pick these up automatically; a category set on an individual listing still wins. eBay ids must come from eBay's live category search."
      />
      <CardContent className="divide-y divide-border/60 py-0 sm:py-0">
        {overview.categories.length === 0 ? (
          <p className="py-6 text-sm text-fg/55">You have no product categories yet. Create some under Categories first.</p>
        ) : (
          overview.categories.map((category) => (
            <CategoryMappingRow
              // Remount when saved values change so the row's draft resets to the server state.
              key={`${category._id}:${overview.platforms.map((p) => byCategory.get(category._id)?.[p.key]?.updated_at ?? "").join("|")}`}
              category={category}
              platforms={overview.platforms}
              mappings={byCategory.get(category._id) ?? {}}
              googleCategories={overview.google_categories}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
