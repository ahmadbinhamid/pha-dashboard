import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { getCategorySuggestions } from "@/lib/api/ebay";
import type { CategorySuggestion } from "@/types/ebay";

interface Props {
  label: string;
  value: string;
  onChange: (id: string, name?: string) => void;
  required?: boolean;
  error?: string;
}

export function EbayCategoryInput({ label, value, onChange, required, error }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function handleQueryChange(q: string) {
    setQuery(q);
    setSelectedName(null);
    onChange(""); // clear until user picks
    setSuggestions([]);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setOpen(false); return; }

    debounceRef.current = setTimeout(() => void fetchSuggestions(q.trim()), 350);
  }

  async function fetchSuggestions(q: string) {
    setLoading(true);
    try {
      const res = await getCategorySuggestions(q);
      if (res.data.sandbox) {
        setSandboxMode(true);
        setSuggestions([]);
        setOpen(false);
      } else {
        setSandboxMode(false);
        setSuggestions(res.data.suggestions.slice(0, 8));
        setOpen(true);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(s: CategorySuggestion) {
    onChange(s.categoryId, s.categoryName);
    setSelectedName(s.breadcrumb);
    setQuery(s.categoryName);
    setOpen(false);
  }

  function handleClear() {
    setSelectedName(null);
    setQuery("");
    onChange("");
  }

  return (
    <div ref={containerRef} className="space-y-1.5">
      <FormField label={label} required={required} error={error}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={sandboxMode ? "Sandbox mode — enter the ID instead" : "Search eBay categories…"}
              disabled={sandboxMode}
              className={selectedName ? "pr-16" : ""}
            />
            {loading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg/40">Searching…</span>
            )}
            {selectedName && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="absolute right-1 top-1/2 h-7 -translate-y-1/2 px-2 text-xs text-fg/50"
              >
                Clear
              </Button>
            )}

            {open && suggestions.length > 0 && (
              <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                {suggestions.map((s) => (
                  <li key={s.categoryId}>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleSelect(s)}
                      className="h-auto w-full flex-col items-start gap-0 rounded-none px-3 py-2 text-left font-normal"
                    >
                      <span className="text-sm font-medium text-fg">{s.categoryName}</span>
                      <span className="text-xs text-fg/50">{s.breadcrumb} · ID: {s.categoryId}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Manual ID: the only way in when sandbox has no category search. */}
          <Input
            value={value}
            onChange={(e) => { onChange(e.target.value); setSelectedName(null); }}
            placeholder="Category ID"
            aria-label="eBay category ID"
            className="tabular-nums sm:w-36"
          />
        </div>
      </FormField>

      {sandboxMode && (
        <p className="text-xs text-fg/50">Category search is unavailable in eBay sandbox; enter the ID.</p>
      )}
    </div>
  );
}
