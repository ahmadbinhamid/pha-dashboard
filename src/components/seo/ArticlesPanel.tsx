import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Newspaper, Plus, Search, Trash2 } from "lucide-react";
import { Can } from "@/components/auth/Can";
import { Badge } from "@/components/ui/Badge";
import { Image } from "@/components/ui/Image";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { SkeletonText } from "@/components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { ContentStateBadge } from "@/components/seo/ContentStateBadge";
import { DEFAULT_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from "@/config/pagination";
import { PERMISSIONS } from "@/config/permissions";
import { CONTENT_STATUS_FILTER_OPTIONS, SEO_BASE_PATH } from "@/config/seo";
import { useToast } from "@/context";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SEO_QUERY_KEY, deleteArticle, getArticleTags, getArticles } from "@/lib/api/seo";
import type { Article, ContentStatus } from "@/types/seo";

const ALL = "all";

export function ArticlesPanel() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [input, setInput] = useState("");
  const search = useDebouncedValue(input.trim(), SEARCH_DEBOUNCE_MS);
  const [status, setStatus] = useState(ALL);
  const [tag, setTag] = useState(ALL);
  const [deleting, setDeleting] = useState<Article | null>(null);

  const params = {
    page,
    limit,
    search: search || undefined,
    status: status === ALL ? undefined : (status as ContentStatus),
    tag: tag === ALL ? undefined : tag,
  };
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...SEO_QUERY_KEY, "articles", params],
    queryFn: () => getArticles(params),
    placeholderData: keepPreviousData,
  });
  const { data: tagsRes } = useQuery({ queryKey: [...SEO_QUERY_KEY, "tags"], queryFn: getArticleTags });
  const articles = data?.data?.items ?? [];
  const tagOptions = [{ value: ALL, label: "All tags" }, ...(tagsRes?.data ?? []).map((t) => ({ value: t.tag, label: `${t.tag} (${t.count})` }))];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteArticle(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SEO_QUERY_KEY });
      toast({ title: "Article deleted", tone: "success" });
      setDeleting(null);
    },
    onError: (err: Error) => toast({ title: "Couldn't delete the article", description: err.message, tone: "danger" }),
  });

  const filter = (set: (v: string) => void) => (v: string) => {
    set(v);
    setPage(1);
  };

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
            <Input placeholder="Search articles…" value={input} onChange={(e) => { setInput(e.target.value); setPage(1); }} className="pl-9" />
          </div>
          <SingleSelect options={CONTENT_STATUS_FILTER_OPTIONS} value={status} onChange={filter(setStatus)} className="sm:w-40 sm:shrink-0" />
          <SingleSelect options={tagOptions} value={tag} onChange={filter(setTag)} className="sm:w-44 sm:shrink-0" />
        </div>
        <Can permission={PERMISSIONS.seo.create}>
          <Button variant="primary" onClick={() => navigate(`${SEO_BASE_PATH}/articles/new`)}>
            <Plus className="h-4 w-4" />
            New article
          </Button>
        </Can>
      </div>

      {isLoading ? (
        <div className="p-5">
          <SkeletonText lines={6} />
        </div>
      ) : articles.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title={search || status !== ALL || tag !== ALL ? "No articles match" : "No articles yet"}
          description="Guides, how-tos and news bring shoppers in from Google and give you something to share."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-200">
            <TableHeader>
              <TableRow>
                <TableHead>Article</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Published</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.map((a) => (
                <TableRow key={a._id} className="cursor-pointer" onClick={() => navigate(`${SEO_BASE_PATH}/articles/${a._id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {a.cover_image ? <Image src={a.cover_image} alt="" className="h-10 w-14 shrink-0 rounded object-cover" /> : null}
                      <div className="min-w-0">
                        <div className="truncate font-medium text-fg">{a.title}</div>
                        <div className="truncate text-xs text-fg/50">/blog/{a.slug}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ContentStateBadge state={a.state} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {a.tags.length ? a.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>) : <span className="text-fg/40">—</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-fg/60">
                    {a.published_at ? new Date(a.published_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Can permission={PERMISSIONS.seo.delete}>
                      <Button variant="ghost" size="icon" aria-label={`Delete ${a.title}`} onClick={() => setDeleting(a)}>
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
      <Pagination
        currentPage={page}
        totalPages={data?.data?.totalPages ?? 1}
        totalItems={data?.data?.total ?? 0}
        itemsPerPage={limit}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        isLoading={isFetching}
        onPageChange={setPage}
      />
      <ConfirmModal
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this article?"
        description={`"${deleting?.title}" comes off the website. Add a redirect if other sites link to it.`}
        confirmLabel="Delete"
        tone="danger"
        confirming={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting._id)}
      />
    </Card>
  );
}
