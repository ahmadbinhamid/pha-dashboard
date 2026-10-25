import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/Table";
import { StickyTableHead, StickyTableCell } from "@/components/ui/StickyTableColumn";
import { Can } from "@/components/auth/Can";
import { PageHeader } from "@/components/shared/PageHeader";
import { CustomersTableSkeleton } from "@/components/customers/CustomersTableSkeleton";
import { BusinessFormModal } from "@/components/businesses/BusinessFormModal";
import { PERMISSIONS } from "@/config/permissions";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { PAYMENT_TERMS_LABEL } from "@/config/businessOptions";
import { BUSINESSES_QUERY_KEY, getBusinesses } from "@/lib/api/businesses";

export default function BusinessesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10);
  const search = searchParams.get("search") ?? "";

  const [inputValue, setInputValue] = useState(search);
  const [formOpen, setFormOpen] = useState(false);

  const updateParams = (changes: Record<string, string | null>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue !== search) updateParams({ search: inputValue || null, page: "1" });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...BUSINESSES_QUERY_KEY, "list", { page, search, limit }],
    queryFn: () => getBusinesses({ page, search, limit }),
  });

  const businesses = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Businesses"
        description={total > 0 ? `${total} business${total !== 1 ? "es" : ""} on file` : "Group customers who represent one business"}
      >
        <Can permission={PERMISSIONS.customers.create}>
          <Button variant="primary" size="md" className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New Business
          </Button>
        </Can>
      </PageHeader>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
            <Input
              placeholder="Search business name…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="pl-9"
            />
          </div>
          {isFetching && !isLoading && <span className="text-xs text-fg/40">Updating…</span>}
        </div>

        {isLoading ? (
          <CustomersTableSkeleton />
        ) : businesses.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={search ? "No businesses found" : "No businesses yet"}
            description={
              search
                ? `No results for "${search}". Try a different term.`
                : "Create a business to add its representatives as separate customers."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-120">
              <TableHeader>
                <TableRow>
                  <StickyTableHead size={52}>Name</StickyTableHead>
                  <TableHead>Account Terms</TableHead>
                  <TableHead className="text-right">Representatives</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {businesses.map((business) => (
                  <TableRow
                    key={business._id}
                    className="group cursor-pointer"
                    onClick={() => navigate(`/businesses/${business._id}`)}
                  >
                    <StickyTableCell size={52} className="truncate font-medium text-fg">
                      {business.name}
                    </StickyTableCell>
                    <TableCell className="text-fg/60">
                      {business.payment_terms_days ? PAYMENT_TERMS_LABEL[business.payment_terms_days] : "—"}
                    </TableCell>
                    <TableCell className="text-right text-fg/60">{business.representatives_count}</TableCell>
                    <TableCell className="text-right text-fg/60">
                      {new Date(business.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          itemsPerPage={limit}
          onLimitChange={(l) => updateParams({ limit: String(l), page: "1" })}
          isLoading={isFetching}
          onPageChange={(p) => updateParams({ page: String(p) })}
        />
      </Card>

      <BusinessFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        business={null}
        onCreated={(created) => navigate(`/businesses/${created._id}`)}
      />
    </div>
  );
}
