import { useState, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/modal";
import { ProductRow } from "@/components/products/product-row";
import { getProducts, deleteProduct } from "@/lib/api/products";
import { useToast } from "@/context";
import type { Product } from "@/types/product";
import { Pagination } from "@/components/ui/pagination";
import { Plus, Search, Package, Trash2, AlertTriangle } from "lucide-react";

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
];

const TABLE_HEADERS = [
  { label: "Product", align: "left" },
  { label: "Status", align: "left" },
  { label: "Type", align: "left" },
  { label: "Price", align: "right" },
  { label: "eBay", align: "left" },
  { label: "Created", align: "right" },
  { label: "Actions", align: "right" },
];


// ── Page ─────────────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1", 10);

  const [inputValue, setInputValue] = useState(search);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

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
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [inputValue, setSearchParams]);

  const setStatus = useCallback(
    (val: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (val) next.set("status", val);
        else next.delete("status");
        next.set("page", "1");
        return next;
      });
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (p: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("page", String(p));
        return next;
      });
    },
    [setSearchParams],
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["products", { search, status, page }],
    queryFn: () => getProducts({ search, status, page }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      toast({ title: "Product deleted", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, tone: "danger" });
      setDeleteTarget(null);
    },
  });

  const products: Product[] = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-fg/55">
            {total > 0
              ? `${total} product${total !== 1 ? "s" : ""} in your catalogue`
              : "Manage your product catalogue"}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          className="gap-2 self-start sm:self-auto"
          onClick={() => navigate("/products/new")}
        >
          <Plus className="h-4 w-4" />
          New Product
        </Button>
      </div>

      <Card>
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40 pointer-events-none" />
            <Input
              placeholder="Search products…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-3">
            {isFetching && !isLoading && (
              <span className="text-xs text-fg/40">Updating…</span>
            )}
            <div className="flex gap-1 rounded-xs bg-bg-2 p-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatus(f.value)}
                  className={`rounded-xs px-3 py-1.5 text-xs font-medium transition ${
                    status === f.value
                      ? "bg-bg text-fg shadow-sm ring-1 ring-inset ring-border"
                      : "text-fg/55 hover:text-fg"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingSkeleton />
          ) : products.length === 0 ? (
            <EmptyState
              search={search}
              onNew={() => navigate("/products/new")}
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-2/40">
                  {TABLE_HEADERS.map((h, i) => (
                    <th
                      key={i}
                      className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-fg/45 ${
                        h.align === "right" ? "text-right" : "text-left"
                      } first:px-5`}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((product) => (
                  <ProductRow
                    key={product._id}
                    product={product}
                    onClick={() => navigate(`/products/${product.slug}/edit`)}
                    onEdit={() => navigate(`/products/${product.slug}/edit`)}
                    onDelete={() => setDeleteTarget(product)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          isLoading={isFetching}
          onPageChange={setPage}
        />
      </Card>

      {/* Delete confirm modal */}
      <Modal
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        {deleteTarget && (
          <ModalContent className="max-w-sm">
            <ModalHeader>
              <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-danger/10">
                <AlertTriangle className="h-5 w-5 text-danger" />
              </div>
              <ModalTitle>Delete product?</ModalTitle>
              <ModalDescription>
                <span className="font-medium text-fg">{deleteTarget.title}</span>{" "}
                will be permanently deleted. This action cannot be undone.
              </ModalDescription>
            </ModalHeader>
            <ModalFooter>
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="flex-1"
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="md"
                className="flex-1 gap-2"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget._id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </Button>
            </ModalFooter>
          </ModalContent>
        )}
      </Modal>
    </div>
  );
}

const SKEL_WIDTHS = [140, 180, 120, 160, 200, 130, 170, 150];

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-border">
      {SKEL_WIDTHS.map((w, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-xs bg-bg-2" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 animate-pulse rounded-xs bg-bg-2" style={{ width: w }} />
            <div className="h-3 w-20 animate-pulse rounded-xs bg-bg-2" />
          </div>
          <div className="h-5 w-14 animate-pulse rounded-xs bg-bg-2" />
          <div className="h-5 w-16 animate-pulse rounded-xs bg-bg-2" />
          <div className="h-5 w-20 animate-pulse rounded-xs bg-bg-2" />
          <div className="h-5 w-16 animate-pulse rounded-xs bg-bg-2" />
          <div className="h-7 w-7 animate-pulse rounded-xs bg-bg-2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ search, onNew }: { search: string; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-xs border border-border bg-bg-2">
        <Package className="h-8 w-8 text-fg/30" />
      </div>
      <div>
        <p className="font-medium text-fg">
          {search ? "No products found" : "No products yet"}
        </p>
        <p className="mt-1 text-sm text-fg/50">
          {search
            ? `No results for "${search}" — try a different term`
            : "Create your first product to get started"}
        </p>
      </div>
      {!search && (
        <Button
          variant="primary"
          size="sm"
          className="mt-1 gap-1.5"
          onClick={onNew}
        >
          <Plus className="h-3.5 w-3.5" />
          New Product
        </Button>
      )}
    </div>
  );
}
