import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { ListingForm } from "@/components/listings/listing-form";
import { useToast } from "@/context";
import { getListing, updateListing, pushListing } from "@/lib/api/listings";
import { EBAY_LISTING_FORM_INITIAL } from "@/types/marketplace";
import type { EbayListing, EbayListingFormState } from "@/types/marketplace";
import type { EbayListingErrors } from "@/lib/validation/ebay-listing";

function normaliseSpn(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    const arr = (raw as string[]).filter((s) => s !== "");
    return arr.length > 0 ? arr : [""];
  }
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [""];
}

function listingToForm(listing: EbayListing): EbayListingFormState {
  const productId =
    typeof listing.product === "object" ? listing.product._id : listing.product;
  const variantId =
    listing.variant && typeof listing.variant === "object"
      ? listing.variant._id
      : (listing.variant as string | null) ?? "";

  const p = listing.product !== null && typeof listing.product === "object" ? listing.product : null;

  const rawFitment = (listing as unknown as Record<string, unknown>).fitment;
  const fitmentRows = Array.isArray(rawFitment) ? (rawFitment as Array<Record<string, unknown>>) : [];

  const pExt = p as unknown as Record<string, unknown>;

  return {
    product_id: productId,
    variant_id: variantId,
    title_override: listing.title_override || p?.title || "",
    description_override: listing.description_override || "",
    price_override: listing.price_override != null
      ? String(listing.price_override)
      : p?.price != null ? String(p.price) : "",
    photo_overrides: (listing.photo_overrides as unknown as import("@/types/product").Attachment[]) || [],
    vehicle_make: typeof pExt?.vehicle_make === "string" ? pExt.vehicle_make : "",
    vehicle_model: typeof pExt?.vehicle_model === "string" ? pExt.vehicle_model : "",
    vehicle_model_code: typeof pExt?.vehicle_model_code === "string" ? pExt.vehicle_model_code : "",
    vehicle_year: pExt?.vehicle_year != null ? String(pExt.vehicle_year) : "",
    ebay_category_id: listing.ebay_category_id || "",
    store_category_id: listing.store_category_id || "",
    store_sku: listing.store_sku || p?.sku || "",
    condition: listing.condition || "NEW",
    condition_notes: listing.condition_notes || "",
    item_specifics: {
      brand: listing.item_specifics?.brand || "",
      mpn: listing.item_specifics?.mpn || "",
      superseded_part_number: normaliseSpn(
        (listing.item_specifics as unknown as Record<string, unknown>)?.superseded_part_number
      ),
      aspects: ((listing.item_specifics as unknown as Record<string, unknown>)?.aspects as Record<string, string>) ?? {},
    },
    fitment: fitmentRows.map((r) => ({
      make: String(r.make ?? ""),
      model: String(r.model ?? ""),
      model_code: String(r.model_code ?? ""),
      year_from: r.year_from != null ? String(r.year_from) : "",
      year_to: r.year_to != null ? String(r.year_to) : "",
    })),
    format: listing.format || "FIXED_PRICE",
    quantity_available:
      listing.quantity_available != null ? String(listing.quantity_available) : "",
    listing_duration: listing.listing_duration || "GTC",
    accept_best_offer: listing.accept_best_offer || false,
    min_best_offer: listing.min_best_offer != null ? String(listing.min_best_offer) : "",
    fulfillment_policy_id: listing.fulfillment_policy_id || "",
    payment_policy_id: listing.payment_policy_id || "",
    return_policy_id: listing.return_policy_id || "",
    require_immediate_payment: listing.require_immediate_payment ?? true,
    item_location_zip: listing.item_location_zip || "",
    package: {
      length: listing.package?.length != null ? String(listing.package.length) : "",
      width: listing.package?.width != null ? String(listing.package.width) : "",
      height: listing.package?.height != null ? String(listing.package.height) : "",
      weight: listing.package?.weight != null ? String(listing.package.weight) : "",
    },
  };
}

export default function ListingEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState<EbayListingFormState>(EBAY_LISTING_FORM_INITIAL);
  const [serverErrors, setServerErrors] = useState<EbayListingErrors>({});

  const { data, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: () => getListing(id!),
    enabled: !!id,
  });

  const listing = data?.data as EbayListing | undefined;

  useEffect(() => {
    if (listing) setForm(listingToForm(listing));
  }, [listing]);

  function patchForm(patch: Partial<EbayListingFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  const saveMutation = useMutation({
    mutationFn: () => updateListing(id!, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listing", id] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast({ title: "Listing saved", tone: "success" });
    },
    onError: (err: Error) => toast({ title: err.message, tone: "danger" }),
  });

  const pushMutation = useMutation({
    mutationFn: async () => {
      await updateListing(id!, form);
      await pushListing(id!);
    },
    onSuccess: () => {
      setServerErrors({});
      queryClient.invalidateQueries({ queryKey: ["listing", id] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast({ title: "Listing queued for eBay sync", tone: "success" });
    },
    onError: (err: Error & { status?: number; errors?: Array<{ field: string; message: string }> }) => {
      if (err.status === 422 && Array.isArray(err.errors)) {
        const mapped: EbayListingErrors = {};
        err.errors.forEach(({ field, message }) => {
          mapped[field as keyof EbayListingErrors] = message;
        });
        setServerErrors(mapped);
      } else {
        toast({ title: err.message, tone: "danger" });
      }
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const productTitle =
    listing && listing.product !== null && typeof listing.product === "object"
      ? listing.product.title
      : "Listing";

  return (
    <div className="space-y-6">
      <BreadcrumbNav
        items={[
          { label: "Listings", href: "/listings" },
          { label: productTitle },
        ]}
      />

      <div>
        <h1 className="text-xl font-semibold tracking-tight">Edit eBay Listing</h1>
        <p className="mt-1 text-sm text-fg/70">{productTitle}</p>
      </div>

      <ListingForm
        form={form}
        onChange={patchForm}
        listing={listing}
        onSaveDraft={() => saveMutation.mutate()}
        onPush={() => pushMutation.mutate()}
        saving={saveMutation.isPending}
        pushing={pushMutation.isPending}
        externalErrors={serverErrors}
        isEdit
      />
    </div>
  );
}
