import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BreadcrumbNav } from "@/components/ui/BreadcrumbNav";
import { SkeletonText } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { DiscountForm } from "@/components/discounts/DiscountForm";
import { DiscountRedemptionsTable } from "@/components/discounts/DiscountRedemptionsTable";
import { DiscountStatusBadge } from "@/components/discounts/DiscountStatusBadge";
import { DiscountUsageStats } from "@/components/discounts/DiscountUsageStats";
import { DISCOUNTS_BASE_PATH } from "@/config/discounts";
import { PERMISSIONS } from "@/config/permissions";
import { useToast } from "@/context";
import { useMyAccess } from "@/hooks/useMyAccess";
import { getCategories } from "@/lib/api/categories";
import { DISCOUNTS_QUERY_KEY, createDiscount, discountQueryKey, getDiscount, updateDiscount } from "@/lib/api/discounts";
import { formValuesToPayload } from "@/lib/discounts/discountForm";
import type { DiscountFormValues } from "@/lib/validation/discount";

const DISCOUNTS_TAB_PATH = "/storefront?tab=discounts";

// Serves /storefront/discounts/new and /storefront/discounts/:id.
export default function DiscountEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  // "Duplicate" passes the copy's values through router state.
  const initialValues = (useLocation().state as { initialValues?: DiscountFormValues } | null)?.initialValues;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can } = useMyAccess();
  const canEdit = can(isNew ? PERMISSIONS.discounts.create : PERMISSIONS.discounts.update);

  const { data, isLoading } = useQuery({ queryKey: discountQueryKey(id ?? ""), queryFn: () => getDiscount(id!), enabled: !isNew });
  const { data: categoriesRes } = useQuery({ queryKey: ["categories", "all"], queryFn: () => getCategories({ limit: 100 }) });
  const discount = data?.data ?? null;

  const mutation = useMutation({
    mutationFn: (values: DiscountFormValues) =>
      isNew ? createDiscount(formValuesToPayload(values)) : updateDiscount(id!, formValuesToPayload(values)),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: DISCOUNTS_QUERY_KEY });
      toast({ title: isNew ? "Discount created" : "Discount saved", tone: "success" });
      if (isNew) navigate(`${DISCOUNTS_BASE_PATH}/${res.data._id}`, { replace: true });
    },
    onError: (err: Error) => toast({ title: "Couldn't save the discount", description: err.message, tone: "danger" }),
  });

  const title = isNew ? "New discount" : (discount?.name ?? "Discount");

  return (
    <div className="space-y-6">
      <BreadcrumbNav
        items={[{ label: "Storefront", href: "/storefront" }, { label: "Discounts", href: DISCOUNTS_TAB_PATH }, { label: title }]}
      />
      <PageHeader title={title} description={isNew ? "Set up a promo code or an automatic deal for your website." : undefined}>
        {discount ? <DiscountStatusBadge status={discount.status} /> : null}
      </PageHeader>

      {!isNew && isLoading ? (
        <SkeletonText lines={10} />
      ) : (
        <>
          {discount ? <DiscountUsageStats usage={discount.usage} /> : null}
          <DiscountForm
            discount={discount}
            initialValues={isNew ? initialValues : undefined}
            categories={categoriesRes?.data?.items ?? []}
            canEdit={canEdit}
            saving={mutation.isPending}
            onSubmit={(values) => mutation.mutate(values)}
            onCancel={() => navigate(DISCOUNTS_TAB_PATH)}
          />
          {discount ? <DiscountRedemptionsTable redemptions={discount.usage.recent} /> : null}
        </>
      )}
    </div>
  );
}
