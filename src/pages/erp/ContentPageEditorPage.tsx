import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BreadcrumbNav } from "@/components/ui/BreadcrumbNav";
import { SkeletonText } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { ContentPageForm } from "@/components/seo/ContentPageForm";
import { SEO_BASE_PATH } from "@/config/seo";
import { PERMISSIONS } from "@/config/permissions";
import { useToast } from "@/context";
import { useMyAccess } from "@/hooks/useMyAccess";
import { SEO_QUERY_KEY, createContentPage, getContentPage, pageQueryKey, updateContentPage } from "@/lib/api/seo";
import type { ContentPageFormValues } from "@/lib/validation/seo";

const PAGES_TAB = `${SEO_BASE_PATH}?tab=pages`;

// Serves /seo/pages/new and /seo/pages/:id.
export default function ContentPageEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can } = useMyAccess();

  const { data, isLoading } = useQuery({ queryKey: pageQueryKey(id ?? ""), queryFn: () => getContentPage(id!), enabled: !isNew });
  const page = data?.data ?? null;

  const mutation = useMutation({
    mutationFn: (values: ContentPageFormValues) => (isNew ? createContentPage(values) : updateContentPage(id!, values)),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: SEO_QUERY_KEY });
      toast({ title: isNew ? "Page created" : "Page saved", tone: "success" });
      if (isNew) navigate(`${SEO_BASE_PATH}/pages/${res.data._id}`, { replace: true });
    },
    onError: (err: Error) => toast({ title: "Couldn't save the page", description: err.message, tone: "danger" }),
  });

  const title = isNew ? "New page" : (page?.title ?? "Page");

  return (
    <div className="space-y-6">
      <BreadcrumbNav items={[{ label: "SEO & Content", href: SEO_BASE_PATH }, { label: "Pages", href: PAGES_TAB }, { label: title }]} />
      <PageHeader title={title} description={isNew ? "About us, FAQs, warranty info: any page your website needs." : undefined} />
      {!isNew && isLoading ? (
        <SkeletonText lines={10} />
      ) : (
        <ContentPageForm
          page={page}
          canEdit={can(isNew ? PERMISSIONS.seo.create : PERMISSIONS.seo.update)}
          canPublish={can(PERMISSIONS.seo.publish)}
          saving={mutation.isPending}
          onSubmit={(values) => mutation.mutate(values)}
          onCancel={() => navigate(PAGES_TAB)}
        />
      )}
    </div>
  );
}
