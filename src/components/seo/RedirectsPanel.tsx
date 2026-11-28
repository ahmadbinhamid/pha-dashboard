import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CornerDownRight, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Can } from "@/components/auth/Can";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonText } from "@/components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { RedirectFormModal } from "@/components/seo/RedirectFormModal";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { PERMISSIONS } from "@/config/permissions";
import { SEO_SEARCH_DEBOUNCE_MS } from "@/config/seo";
import { useToast } from "@/context";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SEO_QUERY_KEY, deleteRedirect, getRedirects } from "@/lib/api/seo";
import type { Redirect } from "@/types/seo";

export function RedirectsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [input, setInput] = useState("");
  const search = useDebouncedValue(input.trim(), SEO_SEARCH_DEBOUNCE_MS);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Redirect | null>(null);
  const [deleting, setDeleting] = useState<Redirect | null>(null);

  const params = { page, limit, search: search || undefined };
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...SEO_QUERY_KEY, "redirects", params],
    queryFn: () => getRedirects(params),
    placeholderData: keepPreviousData,
  });
  const redirects = data?.data?.items ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRedirect(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SEO_QUERY_KEY });
      toast({ title: "Redirect deleted", tone: "success" });
      setDeleting(null);
    },
    onError: (err: Error) => toast({ title: "Couldn't delete the redirect", description: err.message, tone: "danger" }),
  });

  const openForm = (r: Redirect | null) => {
    setEditing(r);
    setFormOpen(true);
  };

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
          <Input placeholder="Search addresses…" value={input} onChange={(e) => { setInput(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Can permission={PERMISSIONS.seo.create}>
          <Button variant="primary" onClick={() => openForm(null)}>
            <Plus className="h-4 w-4" />
            Add redirect
          </Button>
        </Can>
      </div>
      {isLoading ? (
        <div className="p-5">
          <SkeletonText lines={5} />
        </div>
      ) : redirects.length === 0 ? (
        <EmptyState
          icon={CornerDownRight}
          title={search ? "No redirects match" : "No redirects yet"}
          description="Moved or renamed a page? Redirect the old address so links and Google rankings keep working."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-200">
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Visits</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {redirects.map((r) => (
                <TableRow key={r._id}>
                  <TableCell className="font-mono text-xs text-fg">{r.from_path}</TableCell>
                  <TableCell className="text-xs text-fg/70">
                    <span className="inline-flex items-center gap-1.5 font-mono">
                      <ArrowRight className="h-3 w-3 shrink-0 text-fg/40" />
                      {r.to_path}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.type === 301 ? "outline" : "muted"}>{r.type === 301 ? "301 permanent" : "302 temporary"}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-fg/60">
                    {r.hits}
                    {r.last_hit_at ? <div className="text-2xs text-fg/45">last {new Date(r.last_hit_at).toLocaleDateString()}</div> : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Can permission={PERMISSIONS.seo.update}>
                        <Button variant="ghost" size="icon" aria-label="Edit redirect" onClick={() => openForm(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Can>
                      <Can permission={PERMISSIONS.seo.delete}>
                        <Button variant="ghost" size="icon" aria-label="Delete redirect" onClick={() => setDeleting(r)}>
                          <Trash2 className="h-3.5 w-3.5 text-danger" />
                        </Button>
                      </Can>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination
        currentPage={page}
        totalPages={data?.data?.totalPages ?? 1}
        totalItems={data?.data?.total ?? 0}
        itemsPerPage={limit}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        isLoading={isFetching}
        onPageChange={setPage}
      />
      <RedirectFormModal open={formOpen} onOpenChange={setFormOpen} redirect={editing} />
      <ConfirmModal
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this redirect?"
        description={`${deleting?.from_path} will show a "page not found" again.`}
        confirmLabel="Delete"
        tone="danger"
        confirming={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting._id)}
      />
    </Card>
  );
}
