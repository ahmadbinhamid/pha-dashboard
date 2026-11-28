import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Search, Tag } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FieldDensityProvider } from "@/components/ui/FieldDensity";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonText } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { SeoMetaModal, type SeoMetaTarget } from "@/components/seo/SeoMetaModal";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { PERMISSIONS } from "@/config/permissions";
import { META_LIMITS, SEO_SEARCH_DEBOUNCE_MS } from "@/config/seo";
import { useToast } from "@/context";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useMyAccess } from "@/hooks/useMyAccess";
import { SEO_QUERY_KEY, getCategorySeo, getProductSeo, updateCategorySeo, updateProductSeo } from "@/lib/api/seo";
import { stripHtml } from "@/lib/seo/seoText";
import type { SeoMeta } from "@/types/seo";

interface CatalogSeoPanelProps {
  kind: "products" | "categories";
}

interface Row {
  id: string;
  name: string;
  path: string;
  image: string | null;
  description: string;
  seo: SeoMeta;
}

type CatalogParams = Parameters<typeof getProductSeo>[0];

/** Both kinds in one row shape, so the table renders either. */
async function fetchRows(kind: CatalogSeoPanelProps["kind"], params: CatalogParams) {
  if (kind === "products") {
    const { data } = await getProductSeo(params);
    const rows: Row[] = data.items.map((p) => ({
      id: p._id,
      name: p.title,
      path: `/product/${p.slug}`,
      image: p.image,
      description: p.description_text,
      seo: p.seo,
    }));
    return { rows, total: data.total, totalPages: data.totalPages };
  }
  const { data } = await getCategorySeo(params);
  const rows: Row[] = data.items.map((c) => ({
    id: c._id,
    name: c.name,
    path: `/shop/${c._id}`,
    image: null,
    description: stripHtml(c.description || ""),
    seo: c.seo,
  }));
  return { rows, total: data.total, totalPages: data.totalPages };
}

function seoBadge(seo: SeoMeta) {
  if (seo.noindex) return <Badge variant="muted">Hidden from Google</Badge>;
  if (!seo.meta_description) return <Badge variant="warn">No description</Badge>;
  if (seo.meta_description.length > META_LIMITS.description) return <Badge variant="warn">Description too long</Badge>;
  return <Badge variant="ok">Ready</Badge>;
}

export function CatalogSeoPanel({ kind }: CatalogSeoPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can } = useMyAccess();
  const canEdit = can(PERMISSIONS.seo.update);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [input, setInput] = useState("");
  const search = useDebouncedValue(input.trim(), SEO_SEARCH_DEBOUNCE_MS);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState<SeoMetaTarget | null>(null);
  const isProducts = kind === "products";

  const params = { page, limit, search: search || undefined, missing: missing || undefined };
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...SEO_QUERY_KEY, "catalog", kind, params],
    queryFn: () => fetchRows(kind, params),
    placeholderData: keepPreviousData,
  });
  const rows = data?.rows ?? [];

  const mutation = useMutation({
    mutationFn: async ({ id, seo }: { id: string; seo: SeoMeta }) => {
      if (isProducts) await updateProductSeo(id, seo);
      else await updateCategorySeo(id, seo);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SEO_QUERY_KEY });
      toast({ title: "SEO saved", tone: "success" });
      setEditing(null);
    },
    onError: (err: Error) => toast({ title: "Couldn't save", description: err.message, tone: "danger" }),
  });

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
          <Input
            placeholder={isProducts ? "Search products…" : "Search categories…"}
            value={input}
            onChange={(e) => { setInput(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <FieldDensityProvider density="compact">
          <Switch
            checked={missing}
            onCheckedChange={(on) => { setMissing(on); setPage(1); }}
            label="Only missing a description"
            className="sm:w-72"
          />
        </FieldDensityProvider>
      </div>
      {isProducts ? (
        <p className="border-b border-border px-5 py-2 text-xs text-fg/55">Products published to your website. Blank fields fall back to the product's own title and description.</p>
      ) : null}

      {isLoading ? (
        <div className="p-5">
          <SkeletonText lines={6} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Tag} title={missing ? "Everything has a description" : "Nothing here yet"} />
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-200">
            <TableHeader>
              <TableRow>
                <TableHead>{isProducts ? "Product" : "Category"}</TableHead>
                <TableHead>Search title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setEditing({ ...r, fallbackDescription: r.description })}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {r.image ? <img src={r.image} alt="" className="h-9 w-9 shrink-0 rounded object-cover" /> : null}
                      <div className="min-w-0">
                        <div className="truncate font-medium text-fg">{r.name}</div>
                        <div className="truncate text-xs text-fg/50">{r.path}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-fg/60">{r.seo.meta_title || <span className="text-fg/40">Uses the name</span>}</TableCell>
                  <TableCell>{seoBadge(r.seo)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" aria-label={`Edit SEO for ${r.name}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination
        currentPage={page}
        totalPages={data?.totalPages ?? 1}
        totalItems={data?.total ?? 0}
        itemsPerPage={limit}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        isLoading={isFetching}
        onPageChange={setPage}
      />
      <SeoMetaModal
        target={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        saving={mutation.isPending}
        canEdit={canEdit}
        onSave={(seo) => editing && mutation.mutate({ id: editing.id, seo })}
      />
    </Card>
  );
}
