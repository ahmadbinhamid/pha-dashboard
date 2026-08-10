import { useState, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/Table";
import { StickyTableHead, StickyTableCell } from "@/components/ui/StickyTableColumn";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { getListing, getListings, updateListing, pushListing, deleteListing } from "@/lib/api/listings";
import { listingToForm, getListingFallbackImageUrl } from "@/lib/marketplace/listingToForm";
import { useToast } from "@/context";
import type { EbayListing } from "@/types/marketplace";
import type { Product } from "@/types/product";
import { SyncBadge } from "@/components/listings/SyncBadge";
import { ProductPickerModal } from "@/components/listings/ProductPickerModal";
import { ListingRowActionsMenu } from "@/components/listings/ListingRowActionsMenu";
import { Plus, Cloud, Search } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const SYNC_STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Synced", value: "synced" },
  { label: "Pending", value: "pending" },
  { label: "Out of Stock", value: "out_of_stock" },
  { label: "Price Locked (On Sale)", value: "price_locked" },
  { label: "Error", value: "error" },
  { label: "Not listed", value: "not_listed" },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ListingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-synced state (survives refresh/back navigation)
  const search = searchParams.get("search") ?? "";
  const syncStatus = searchParams.get("sync_status") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10);

  // Local UI state (doesn't need to be in URL)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EbayListing | null>(null);
  const [inputValue, setInputValue] = useState(search);

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

  const setSyncStatus = useCallback(
    (val: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (val) next.set("sync_status", val);
        else next.delete("sync_status");
        next.set("page", "1");
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (p: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("page", String(p));
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const setLimit = useCallback(
    (l: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("limit", String(l));
        next.set("page", "1");
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["listings", { page, limit, sync_status: syncStatus, search }],
    queryFn: () =>
      getListings({
        page,
        limit,
        ...(syncStatus ? { sync_status: syncStatus } : {}),
        ...(search ? { search } : {}),
      }),
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
    // Resave first so description_override is regenerated from current
    // product/listing data (e.g. the real photo) before eBay receives it —
    // pushing straight from here previously resent whatever HTML happened to
    // already be stored, which was stale for anything synced before a
    // description-generator change.
    mutationFn: async (id: string) => {
      const { data: listing } = await getListing(id);
      const vehicle =
        listing.product !== null && typeof listing.product === "object"
          ? listing.product.vehicle ?? null
          : null;
      await updateListing(id, listingToForm(listing), vehicle, getListingFallbackImageUrl(listing));
      await pushListing(id);
    },
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
      <PageHeader
        title="Listings"
        description={
          total > 0
            ? `${total} listing${total !== 1 ? "s" : ""} across your channels`
            : "Manage your channel listings"
        }
      >
        <Button variant="primary" size="md" className="gap-2" onClick={() => setPickerOpen(true)}>
          <Plus className="h-4 w-4" />
          New Listing
        </Button>
      </PageHeader>

      <Card>
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40 pointer-events-none" />
            <Input
              placeholder="Search listings…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-3">
            {isFetching && !isLoading && (
              <span className="text-xs text-fg/40">Updating…</span>
            )}
            <FilterSelect options={SYNC_STATUS_FILTERS} value={syncStatus} onChange={setSyncStatus} />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : listings.length === 0 ? (
          <EmptyState onNew={() => setPickerOpen(true)} />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-180">
              <TableHeader>
                <TableRow>
                  <StickyTableHead size={52}>
                    Product
                  </StickyTableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Synced</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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
                    <TableRow
                      key={listing._id}
                      className="group cursor-pointer"
                      onClick={() => navigate(`/listings/${listing._id}/edit`)}
                    >
                      <StickyTableCell size={52} className="truncate font-medium text-fg">
                        {productTitle}
                      </StickyTableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {listing.platform}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-fg/60">{sku}</TableCell>
                      <TableCell>
                        <SyncBadge status={listing.sync_status} />
                      </TableCell>
                      <TableCell className="text-fg/60">{syncedAt}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <ListingRowActionsMenu
                            onPush={() => pushMutation.mutate(listing._id)}
                            pushDisabled={pushMutation.isPending}
                            onEdit={() => navigate(`/listings/${listing._id}/edit`)}
                            onDelete={() => setDeleteTarget(listing)}
                            ebayItemUrl={listing.ebay_item_url}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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

      <ProductPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleProductSelected}
      />

      <Modal
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
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
              className="rounded-xs border border-border bg-bg px-4 py-2 text-sm text-fg transition-colors hover:bg-bg-2"
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
              className="rounded-xs bg-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-danger/90 disabled:opacity-50"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

// ── Skeleton & empty state ────────────────────────────────────────────────────

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
