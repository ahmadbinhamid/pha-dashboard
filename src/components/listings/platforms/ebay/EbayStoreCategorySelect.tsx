import { useEffect, useState } from "react";
import { FormField } from "@/components/ui/form-field";
import { NativeSelect } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { getStoreCategories } from "@/lib/api/ebay";
import type { StoreCategory } from "@/types/ebay";

interface Props {
  value: string;
  onChange: (id: string) => void;
  error?: string;
}

export function EbayStoreCategorySelect({ value, onChange, error }: Props) {
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getStoreCategories()
      .then((res) => setCategories(res.data.categories))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  if (failed || (!loading && categories.length === 0)) {
    return (
      <FormField label="Store Category" error={error}>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter store category ID manually"
        />
        <p className="mt-1 text-xs text-fg/40">
          {failed
            ? "Could not load store categories — enter ID manually."
            : "No store categories found on this account."}
        </p>
      </FormField>
    );
  }

  return (
    <FormField label="Store Category" error={error}>
      <NativeSelect
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
      >
        <option value="">{loading ? "Loading…" : "Select store category…"}</option>
        {categories.map((c) => (
          <option key={c.categoryId} value={c.categoryId}>
            {"  ".repeat(c.level)}{c.name}
          </option>
        ))}
      </NativeSelect>
    </FormField>
  );
}
