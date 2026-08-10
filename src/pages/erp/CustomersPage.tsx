import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/Table";
import { StickyTableHead, StickyTableCell } from "@/components/ui/StickyTableColumn";
import { PageHeader } from "@/components/shared/PageHeader";
import { CustomerAccountBadge } from "@/components/customers/CustomerAccountBadge";
import { CustomerFormModal } from "@/components/customers/CustomerFormModal";
import { CustomerDeleteModal } from "@/components/customers/CustomerDeleteModal";
import { getCustomers } from "@/lib/api/customers";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import type { Customer } from "@/types/customer";
import { Plus, Users, Pencil, Trash2, Search } from "lucide-react";

export default function CustomersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10);
  const search = searchParams.get("search") ?? "";

  const [inputValue, setInputValue] = useState(search);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const setPage = (p: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("page", String(p));
      return next;
    }, { replace: true });
  };

  const setLimit = (l: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("limit", String(l));
      next.set("page", "1");
      return next;
    }, { replace: true });
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchParams((prev) => {
        const current = prev.get("search") ?? "";
        if (inputValue === current) return prev; // no change — don't reset page
        const next = new URLSearchParams(prev);
        if (inputValue) next.set("search", inputValue);
        else next.delete("search");
        next.set("page", "1");
        return next;
      }, { replace: true });
    }, 400);
    return () => clearTimeout(timer);
  }, [inputValue, setSearchParams]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["customers", { page, search, limit }],
    queryFn: () => getCustomers({ page, search, limit }),
  });

  const customers: Customer[] = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 1;

  const openCreate = () => {
    setEditingCustomer(null);
    setFormOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description={total > 0 ? `${total} customer${total !== 1 ? "s" : ""} on file` : "Manage your customer records"}
      >
        <Button variant="primary" size="md" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Customer
        </Button>
      </PageHeader>

      <Card>
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none text-fg/40" />
            <Input
              placeholder="Search name, email, phone…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="pl-9"
            />
          </div>
          {isFetching && !isLoading && <span className="text-xs text-fg/40">Updating…</span>}
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : customers.length === 0 ? (
          <EmptyState search={search} onNew={openCreate} />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-200">
              <TableHeader>
                <TableRow>
                  <StickyTableHead size={52}>
                    Name
                  </StickyTableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow
                    key={customer._id}
                    className="group cursor-pointer"
                    onClick={() => navigate(`/customers/${customer._id}`)}
                  >
                    <StickyTableCell size={52}>
                      <div className="truncate font-medium text-fg">{customer.name}</div>
                      <div className="truncate text-xs text-fg/50">{customer.email || "—"}</div>
                    </StickyTableCell>
                    <TableCell className="text-fg/60">{customer.phone || "—"}</TableCell>
                    <TableCell className="text-right text-fg/60">{customer.orders_count}</TableCell>
                    <TableCell className="text-right text-fg/60">
                      {customer.outstanding_invoices_count > 0 ? (
                        <span className="font-medium text-danger">{customer.outstanding_invoices_count}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <CustomerAccountBadge hasOnlineAccount={customer.has_online_account} />
                    </TableCell>
                    <TableCell className="text-right text-fg/60">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(customer)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(customer)}>
                          <Trash2 className="h-3.5 w-3.5 text-danger" />
                        </Button>
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
          totalPages={totalPages}
          totalItems={total}
          itemsPerPage={limit}
          onLimitChange={setLimit}
          isLoading={isFetching}
          onPageChange={setPage}
        />
      </Card>

      <CustomerFormModal open={formOpen} onOpenChange={setFormOpen} customer={editingCustomer} />
      <CustomerDeleteModal customer={deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-border">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <div className="h-4 w-40 animate-pulse rounded-xs bg-bg-2" />
          <div className="h-4 w-24 animate-pulse rounded-xs bg-bg-2" />
          <div className="ml-auto h-4 w-10 animate-pulse rounded-xs bg-bg-2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ search, onNew }: { search: string; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-xs border border-border bg-bg-2">
        <Users className="h-8 w-8 text-fg/30" />
      </div>
      <div>
        <p className="font-medium text-fg">{search ? "No customers found" : "No customers yet"}</p>
        <p className="mt-1 text-sm text-fg/50">
          {search ? `No results for "${search}" — try a different term` : "Create your first customer to get started"}
        </p>
      </div>
      {!search && (
        <Button variant="primary" size="sm" className="mt-1 gap-1.5" onClick={onNew}>
          <Plus className="h-3.5 w-3.5" />
          New Customer
        </Button>
      )}
    </div>
  );
}
