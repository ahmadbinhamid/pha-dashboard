import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { TagProductResultRow } from "@/components/tags/TagProductResultRow";
import { useToast } from "@/context";
import { getProducts } from "@/lib/api/products";
import { TAG_QUERY_KEYS, addToTagQueue } from "@/lib/api/tags";
import type { TagQueueItem, TagQueueMode } from "@/types/tags";

const RESULT_LIMIT = 8;

// Compact "add to queue" search; results drop down under the field.
export function TagProductSearch({ queue }: { queue: TagQueueItem[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["tag-product-search", search],
    queryFn: () => getProducts({ search, limit: RESULT_LIMIT }),
    enabled: search.length > 0,
  });
  const results = data?.data?.items ?? [];
  const queued = new Map(queue.map((q) => [q.product._id, q.copies]));

  const addMutation = useMutation({
    mutationFn: ({ productId, mode }: { productId: string; mode: TagQueueMode }) => addToTagQueue(productId, { mode }),
    onSuccess: (res) => {
      const copies = res.data?.copies ?? 1;
      toast({ title: `${copies} tag${copies === 1 ? "" : "s"} in the queue for this product`, tone: "success" });
      void queryClient.invalidateQueries({ queryKey: TAG_QUERY_KEYS.queue });
    },
    onError: (err: Error) => toast({ title: "Couldn't add to the queue", description: err.message, tone: "danger" }),
  });

  return (
    <div ref={containerRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
      <Input
        size="sm"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="Search"
        aria-label="Search products to tag"
        className="h-9 pl-9 text-sm"
      />
      {isFetching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-fg/40" />}

      {open && search && (
        <div className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {isError ? (
            <p className="px-4 py-5 text-center text-sm text-danger">Search failed; try again.</p>
          ) : !results.length ? (
            <p className="px-4 py-5 text-center text-sm text-fg/55">{isFetching ? "Searching…" : `No products match "${search}".`}</p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {results.map((p) => (
                <TagProductResultRow
                  key={p._id}
                  product={p}
                  queuedCopies={queued.get(p._id) ?? null}
                  adding={addMutation.isPending}
                  onAddWhole={() => addMutation.mutate({ productId: p._id, mode: "set" })}
                  onAddOne={() => addMutation.mutate({ productId: p._id, mode: "increment" })}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
