import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { NativeSelect } from "@/components/ui/Select";
import { EbayCategoryInput } from "@/components/listings/platforms/ebay/EbayCategoryInput";
import { useToast } from "@/context";
import { deleteCategoryMapping, saveCategoryMapping } from "@/lib/api/categoryMappings";
import type { CategoryMapping, ChannelCategoryOption, MappableCategory } from "@/types/categoryMapping";

interface Props {
  category: MappableCategory;
  platforms: { key: string; name: string }[];
  // Current saved mapping per platform key.
  mappings: Record<string, CategoryMapping | undefined>;
  googleCategories: ChannelCategoryOption[];
}

type Draft = Record<string, { id: string; name: string | null }>;

function draftFrom(platforms: Props["platforms"], mappings: Props["mappings"]): Draft {
  return Object.fromEntries(
    platforms.map(({ key }) => [key, { id: mappings[key]?.external_category_id ?? "", name: mappings[key]?.external_category_name ?? null }]),
  );
}

// One tenant category mapped per channel; saved explicitly per row.
export function CategoryMappingRow({ category, platforms, mappings, googleCategories }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(platforms, mappings));

  const changed = platforms.filter(({ key }) => (draft[key]?.id ?? "") !== (mappings[key]?.external_category_id ?? ""));

  const saveMutation = useMutation({
    mutationFn: () =>
      Promise.all(
        changed.map(({ key }) =>
          draft[key].id
            ? saveCategoryMapping(category._id, key, { external_category_id: draft[key].id, external_category_name: draft[key].name })
            : deleteCategoryMapping(category._id, key),
        ),
      ),
    onSuccess: () => {
      toast({ title: `Saved defaults for ${category.name}`, tone: "success" });
      void queryClient.invalidateQueries({ queryKey: ["category-mappings"] });
      void queryClient.invalidateQueries({ queryKey: ["product-mapped-categories"] });
    },
    onError: (err: Error) => toast({ title: err.message, tone: "danger" }),
  });

  function setPlatform(key: string, id: string, name: string | null = null) {
    setDraft((prev) => ({ ...prev, [key]: { id, name } }));
  }

  function renderInput(key: string, label: string) {
    const value = draft[key]?.id ?? "";
    if (key === "ebay") {
      return (
        <EbayCategoryInput
          label={label}
          value={value}
          onChange={(id, name) => setPlatform(key, id, name ?? draft[key]?.name ?? null)}
        />
      );
    }
    if (key === "google") {
      const suggestion = category.suggestions.google;
      return (
        <FormField label={label}>
          <NativeSelect
            value={value}
            onChange={(e) => setPlatform(key, e.target.value, googleCategories.find((c) => c.id === e.target.value)?.name ?? null)}
          >
            <option value="">Not mapped</option>
            {/* Keep a saved id outside the list selectable instead of blank. */}
            {value && !googleCategories.some((c) => c.id === value) && (
              <option value={value}>{draft[key]?.name || `Category ${value}`}</option>
            )}
            {googleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name.split(" > ").slice(-1)[0]} ({c.id})
              </option>
            ))}
          </NativeSelect>
          {suggestion && value !== suggestion.id && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 justify-start gap-1 self-start px-2 text-xs text-accent"
              onClick={() => setPlatform(key, suggestion.id, suggestion.name)}
            >
              <Sparkles className="h-3 w-3" />
              {suggestion.matched ? "Suggested" : "General default"}: {suggestion.name.split(" > ").slice(-1)[0]}
            </Button>
          )}
        </FormField>
      );
    }
    return (
      <FormField label={label}>
        <Input value={value} onChange={(e) => setPlatform(key, e.target.value.trim())} placeholder="Category id" />
      </FormField>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-4 lg:flex-row lg:items-start">
      <p className="text-sm font-semibold text-fg lg:w-48 lg:shrink-0 lg:pt-7">{category.name}</p>
      {platforms.map(({ key, name }) => (
        <div key={key} className="min-w-0 lg:flex-1">
          {renderInput(key, `${name} category`)}
        </div>
      ))}
      <div className="lg:pt-6">
        <Button
          type="button"
          size="sm"
          variant={changed.length ? "primary" : "outline"}
          disabled={!changed.length || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
