import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BreadcrumbNav } from "@/components/ui/BreadcrumbNav";
import { SkeletonText } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { ArticleForm } from "@/components/seo/ArticleForm";
import { ContentStateBadge } from "@/components/seo/ContentStateBadge";
import { SEO_BASE_PATH } from "@/config/seo";
import { PERMISSIONS } from "@/config/permissions";
import { useToast } from "@/context";
import { useMyAccess } from "@/hooks/useMyAccess";
import { SEO_QUERY_KEY, articleQueryKey, createArticle, getArticle, updateArticle } from "@/lib/api/seo";
import type { ArticleFormValues } from "@/lib/validation/seo";

const BLOG_TAB = `${SEO_BASE_PATH}?tab=articles`;

// Serves /seo/articles/new and /seo/articles/:id.
export default function ArticleEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can } = useMyAccess();
  const canEdit = can(isNew ? PERMISSIONS.seo.create : PERMISSIONS.seo.update);

  const { data, isLoading } = useQuery({ queryKey: articleQueryKey(id ?? ""), queryFn: () => getArticle(id!), enabled: !isNew });
  const article = data?.data ?? null;

  const mutation = useMutation({
    mutationFn: (values: ArticleFormValues) => (isNew ? createArticle(values) : updateArticle(id!, values)),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: SEO_QUERY_KEY });
      toast({ title: isNew ? "Article created" : "Article saved", tone: "success" });
      if (isNew) navigate(`${SEO_BASE_PATH}/articles/${res.data._id}`, { replace: true });
    },
    onError: (err: Error) => toast({ title: "Couldn't save the article", description: err.message, tone: "danger" }),
  });

  const title = isNew ? "New article" : (article?.title ?? "Article");

  return (
    <div className="space-y-6">
      <BreadcrumbNav items={[{ label: "SEO & Content", href: SEO_BASE_PATH }, { label: "Blog", href: BLOG_TAB }, { label: title }]} />
      <PageHeader title={title}>{article ? <ContentStateBadge state={article.state} /> : null}</PageHeader>
      {!isNew && isLoading ? (
        <SkeletonText lines={10} />
      ) : (
        <ArticleForm
          article={article}
          canEdit={canEdit}
          canPublish={can(PERMISSIONS.seo.publish)}
          saving={mutation.isPending}
          onSubmit={(values) => mutation.mutate(values)}
          onCancel={() => navigate(BLOG_TAB)}
        />
      )}
    </div>
  );
}
