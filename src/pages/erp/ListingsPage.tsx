import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { getListings, pushListing, deleteListing } from "@/lib/api/listings";
import { useToast } from "@/context";
import type { EbayListing } from "@/types/marketplace";
import type { Product } from "@/types/product";
import { SyncBadge } from "@/components/listings/sync-badge";
import { ProductPickerModal } from "@/components/listings/product-picker-modal";
import { Plus, Cloud, Pencil, Trash2 } from "lucide-react";

// ── Main page ─────────────────────────────────────────────────────────────────

const TABLE_HEADERS = [
  { label: "Product", align: "left" },
  { label: "Platform", align: "left" },
  { label: "SKU", align: "left" },
  { label: "Status", align: "left" },
  { label: "Last Synced", align: "left" },
  { label: "Actions", align: "right" },
];

export default function ListingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EbayListing | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["listings", { page }],
    queryFn: () => getListings({ page, limit: 20 }),
  });

  const listings: EbayListing[] = (data?.data?.items ?? []) as EbayListing[];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 1;

  const deleteListingProduct =
    deleteTarget?.product !== null && typeof deleteTarget?.product === "object"
      ? (deleteTarget?.product as { title?: string })
      : null;
  const deleteListingName = deleteListingProduct?.title ?? "This listing";
  const deleteListingIsLive =
    !!deleteTarget?.external_offer_id || !!deleteTarget?.external_listing_id;

  const pushMutation = useMutation({
    mutationFn: (id: string) => pushListing(id),
    onSuccess: () => {
      toast({ title: "Queued for eBay sync", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
    onError: (err: Error) => toast({ title: err.message, tone: "danger" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteListing(id),
    onSuccess: () => {
      toast({ title: "Listing deleted", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
    onError: (err: Error) => toast({ title: err.message, tone: "danger" }),
  });

  function handleProductSelected(product: Product) {
    setPickerOpen(false);
    navigate(`/listings/new?product=${product._id}&productSlug=${product.slug}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Listings</h1>
          <p className="mt-1 text-sm text-fg/55">
            {total > 0
              ? `${total} listing${total !== 1 ? "s" : ""} across your channels`
              : "Manage your channel listings"}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          className="gap-2 self-start sm:self-auto"
          onClick={() => setPickerOpen(true)}
        >
          <Plus className="h-4 w-4" />
          New Listing
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          {isLoading ? (
            <LoadingSkeleton />
          ) : listings.length === 0 ? (
            <EmptyState onNew={() => setPickerOpen(true)} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-2/40">
                  {TABLE_HEADERS.map((h, i) => (
                    <th
                      key={i}
                      className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-fg/45 first:px-5 ${
                        h.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listings.map((listing) => {
                  const productObj =
                    listing.product !== null && typeof listing.product === "object"
                      ? listing.product
                      : null;
                  const productTitle = productObj?.title ?? "—";
                  const sku = listing.store_sku || productObj?.sku || "—";
                  const syncedAt = listing.synced_at
                    ? new Date(listing.synced_at).toLocaleDateString("en-AU")
                    : "—";

                  return (
                    <tr
                      key={listing._id}
                      className="hover:bg-bg-2/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/listings/${listing._id}/edit`)}
                    >
                      <td className="px-5 py-3 font-medium text-fg">{productTitle}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="capitalize">
                          {listing.platform}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-fg/60">{sku}</td>
                      <td className="px-4 py-3">
                        <SyncBadge status={listing.sync_status} />
                      </td>
                      <td className="px-4 py-3 text-fg/60">{syncedAt}</td>
                      <td className="px-4 py-3 text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            title="Push to eBay"
                            onClick={() => pushMutation.mutate(listing._id)}
                            disabled={pushMutation.isPending}
                            className="rounded p-1.5 text-fg/50 hover:bg-bg-2 hover:text-primary transition-colors"
                          >
                            <Cloud className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => navigate(`/listings/${listing._id}/edit`)}
                            className="rounded p-1.5 text-fg/50 hover:bg-bg-2 hover:text-fg transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            onClick={() => setDeleteTarget(listing)}
                            className="rounded p-1.5 text-fg/50 hover:bg-bg-2 hover:text-danger transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          isLoading={isLoading}
          onPageChange={setPage}
        />
      </Card>

      <ProductPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleProductSelected}
      />

      <Modal
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
      >
        <ModalContent className="max-w-sm">
          <ModalHeader>
            <ModalTitle>Delete listing?</ModalTitle>
            <ModalDescription>
              {deleteTarget && (
                <>
                  <span className="font-medium text-fg">{deleteListingName}</span> will be
                  permanently removed.
                  {deleteListingIsLive && (
                    <span className="mt-1 block text-amber-500">
                      This listing is live on eBay and will also be withdrawn.
                    </span>
                  )}
                </>
              )}
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-xs border border-border bg-bg px-4 py-2 text-sm text-fg hover:bg-bg-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                deleteMutation.mutate(deleteTarget._id, {
                  onSuccess: () => setDeleteTarget(null),
                });
              }}
              className="rounded-xs bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90 transition-colors disabled:opacity-50"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <div className="h-4 w-40 animate-pulse rounded bg-bg-2" />
          <div className="h-5 w-14 animate-pulse rounded-full bg-bg-2" />
          <div className="h-4 w-24 animate-pulse rounded bg-bg-2" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-bg-2" />
          <div className="h-4 w-20 animate-pulse rounded bg-bg-2" />
          <div className="ml-auto flex gap-2">
            <div className="h-7 w-7 animate-pulse rounded bg-bg-2" />
            <div className="h-7 w-7 animate-pulse rounded bg-bg-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-xs border border-border bg-bg-2">
        <Cloud className="h-8 w-8 text-fg/30" />
      </div>
      <div>
        <p className="font-medium text-fg">No listings yet</p>
        <p className="mt-1 text-sm text-fg/50">
          Create your first listing to start selling on eBay.
        </p>
      </div>
      <Button variant="primary" size="sm" className="mt-1 gap-1.5" onClick={onNew}>
        <Plus className="h-3.5 w-3.5" />
        New Listing
      </Button>
    </div>
  );
}
