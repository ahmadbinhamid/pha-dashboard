import { useEffect, useRef, useState } from "react";
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

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await getCategorySuggestions(q.trim());
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
    }, 350);
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

  const showManual = sandboxMode || (!loading && query.length === 0 && !selectedName);

  return (
    <div ref={containerRef} className="space-y-1.5">
      <FormField label={label} required={required} error={error}>
        <div className="relative">
          <Input
            value={selectedName ? query : query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={sandboxMode ? "Sandbox mode — enter ID manually below" : "Search eBay categories…"}
            disabled={sandboxMode}
            className={selectedName ? "pr-16" : ""}
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg/40">
              Searching…
            </span>
          )}
          {selectedName && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-xs text-fg/50 hover:text-fg"
            >
              Clear
            </button>
          )}

          {open && suggestions.length > 0 && (
            <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
              {suggestions.map((s) => (
                <li key={s.categoryId}>
                  <button
                    type="button"
                    onClick={() => handleSelect(s)}
                    className="flex w-full flex-col px-3 py-2 text-left hover:bg-muted"
                  >
                    <span className="text-sm font-medium text-fg">{s.categoryName}</span>
                    <span className="text-xs text-fg/50">{s.breadcrumb} · ID: {s.categoryId}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </FormField>

      {/* Manual ID input — always visible as fallback */}
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => { onChange(e.target.value); setSelectedName(null); }}
          placeholder="Or enter category ID manually"
          className="text-xs text-fg/70"
        />
        {value && (
          <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs text-fg/60">
            ID: {value}
          </span>
        )}
      </div>

      {sandboxMode && (
        <p className="text-xs text-fg/50">
          Category search is unavailable in eBay sandbox — use the manual ID field above.
        </p>
      )}
    </div>
  );
}
