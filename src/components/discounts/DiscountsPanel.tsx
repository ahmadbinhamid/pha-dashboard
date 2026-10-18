import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Can } from "@/components/auth/Can";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InlineNotice } from "@/components/ui/InlineNotice";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SkeletonText } from "@/components/ui/Skeleton";
import { DiscountListItem } from "@/components/discounts/DiscountListItem";
import { DiscountTemplateGrid } from "@/components/discounts/DiscountTemplateGrid";
import { DiscountTemplateMenu } from "@/components/discounts/DiscountTemplateMenu";
import { DISCOUNT_LIST_FILTERS, DISCOUNTS_BASE_PATH, type DISCOUNT_TEMPLATES } from "@/config/discounts";
import { PERMISSIONS } from "@/config/permissions";
import { useToast } from "@/context";
import { DISCOUNTS_QUERY_KEY, deleteDiscount, getDiscounts, updateDiscount } from "@/lib/api/discounts";
import { duplicateFormValues, templateFormValues } from "@/lib/discounts/discountForm";
import { filterDiscounts, overlappingAutomaticCount, type DiscountListFilter } from "@/lib/discounts/discountFilters";
import type { Discount } from "@/types/discount";

/** Storefront › Discounts: every promo code and automatic deal, one list. */
export function DiscountsPanel({ promotedId }: { promotedId: string | null }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<DiscountListFilter>("all");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<Discount | null>(null);

  const { data, isLoading } = useQuery({ queryKey: DISCOUNTS_QUERY_KEY, queryFn: getDiscounts });
  const discounts = data?.data ?? [];
  const visible = filterDiscounts(discounts, filter, search);
  const overlapping = overlappingAutomaticCount(discounts);
  const filterOptions = DISCOUNT_LIST_FILTERS.map((o) => ({ ...o, label: `${o.label} · ${filterDiscounts(discounts, o.value, "").length}` }));

  const startFrom = (template: (typeof DISCOUNT_TEMPLATES)[number]) =>
    navigate(`${DISCOUNTS_BASE_PATH}/new`, { state: { initialValues: templateFormValues(template.values) } });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: DISCOUNTS_QUERY_KEY });
  const onError = (err: Error) => toast({ title: "Something went wrong", description: err.message, tone: "danger" });
  const toggleMutation = useMutation({
    mutationFn: (d: Discount) => updateDiscount(d._id, { active: !d.active }),
    onSuccess: (res) => {
      invalidate();
      toast({ title: res.data.active ? "Discount resumed" : "Discount paused", tone: "success" });
    },
    onError,
  });
  const deleteMutation = useMutation({
    mutationFn: (d: Discount) => deleteDiscount(d._id),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      toast({ title: "Discount deleted", tone: "success" });
    },
    onError,
  });

  if (isLoading) return <SkeletonText lines={6} />;

  if (!discounts.length) {
    return (
      <Card>
        <CardHeader title="Create your first discount" description="Pick a starting point. You can change everything before saving." />
        <CardContent>
          <DiscountTemplateGrid onPick={startFrom} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Discounts"
        description="Codes only work when typed at checkout. Automatic deals apply on their own. One discount per order."
        right={
          <Can permission={PERMISSIONS.discounts.create}>
            <DiscountTemplateMenu onPick={startFrom} />
          </Can>
        }
      />
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <SegmentedControl options={filterOptions} value={filter} onChange={setFilter} ariaLabel="Filter discounts" size="sm" />
        <div className="relative w-full sm:max-w-60">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fg/40" />
          <Input size="sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or code…" className="pl-9" />
        </div>
      </div>
      {overlapping > 1 ? (
        <InlineNotice variant="warn" className="mx-4 mt-3 sm:mx-5">
          {overlapping} automatic deals can apply to the same order; the shopper gets the biggest saving.
        </InlineNotice>
      ) : null}

      {visible.length ? (
        <div className="divide-y divide-border">
          {visible.map((d) => (
            <DiscountListItem
              key={d._id}
              discount={d}
              promoted={d._id === promotedId}
              onOpen={() => navigate(`${DISCOUNTS_BASE_PATH}/${d._id}`)}
              onDuplicate={() => navigate(`${DISCOUNTS_BASE_PATH}/new`, { state: { initialValues: duplicateFormValues(d) } })}
              onToggleActive={() => toggleMutation.mutate(d)}
              onDelete={() => setDeleting(d)}
            />
          ))}
        </div>
      ) : (
        <p className="px-5 py-10 text-center text-sm text-fg/50">No discounts match this filter.</p>
      )}

      <ConfirmModal
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this discount?"
        description={deleting ? `"${deleting.name}" stops working immediately. Past orders keep their discount.` : undefined}
        confirmLabel="Delete discount"
        tone="danger"
        confirming={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </Card>
  );
}
