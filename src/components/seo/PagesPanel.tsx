import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Search, Trash2 } from "lucide-react";
import { Can } from "@/components/auth/Can";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { SkeletonText } from "@/components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { ContentStateBadge } from "@/components/seo/ContentStateBadge";
import { PERMISSIONS } from "@/config/permissions";
import { SEO_BASE_PATH, SEO_SEARCH_DEBOUNCE_MS } from "@/config/seo";
import { useToast } from "@/context";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SEO_QUERY_KEY, deleteContentPage, getContentPages } from "@/lib/api/seo";
import type { ContentPage } from "@/types/seo";

export function PagesPanel() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const search = useDebouncedValue(input.trim(), SEO_SEARCH_DEBOUNCE_MS);
  const [deleting, setDeleting] = useState<ContentPage | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [...SEO_QUERY_KEY, "pages", search],
    queryFn: () => getContentPages({ search: search || undefined }),
  });
  const pages = data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteContentPage(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SEO_QUERY_KEY });
      toast({ title: "Page deleted", tone: "success" });
      setDeleting(null);
    },
    onError: (err: Error) => toast({ title: "Couldn't delete the page", description: err.message, tone: "danger" }),
  });

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
          <Input placeholder="Search pages…" value={input} onChange={(e) => setInput(e.target.value)} className="pl-9" />
        </div>
        <Can permission={PERMISSIONS.seo.create}>
          <Button variant="primary" onClick={() => navigate(`${SEO_BASE_PATH}/pages/new`)}>
            <Plus className="h-4 w-4" />
            New page
          </Button>
        </Can>
      </div>
      {isLoading ? (
        <div className="p-5">
          <SkeletonText lines={5} />
        </div>
      ) : pages.length === 0 ? (
        <EmptyState icon={FileText} title={search ? "No pages match" : "No pages yet"} description="Add About us, FAQs, warranty or fitment guides." />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Footer</TableHead>
                <TableHead className="text-right">Updated</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((p) => (
                <TableRow key={p._id} className="cursor-pointer" onClick={() => navigate(`${SEO_BASE_PATH}/pages/${p._id}`)}>
                  <TableCell>
                    <div className="font-medium text-fg">{p.title}</div>
                    <div className="text-xs text-fg/50">/pages/{p.slug}</div>
                  </TableCell>
                  <TableCell>
                    <ContentStateBadge state={p.status === "published" ? "published" : "draft"} />
                  </TableCell>
                  <TableCell>{p.show_in_footer ? <Badge variant="outline">In footer</Badge> : <span className="text-fg/40">—</span>}</TableCell>
                  <TableCell className="text-right text-fg/60">{new Date(p.updated_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Can permission={PERMISSIONS.seo.delete}>
                      <Button variant="ghost" size="icon" aria-label={`Delete ${p.title}`} onClick={() => setDeleting(p)}>
                        <Trash2 className="h-3.5 w-3.5 text-danger" />
                      </Button>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <ConfirmModal
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this page?"
        description={`"${deleting?.title}" comes off the website and out of the footer.`}
        confirmLabel="Delete"
        tone="danger"
        confirming={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting._id)}
      />
    </Card>
  );
}
