import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BreadcrumbNav } from "@/components/ui/BreadcrumbNav";
import { Skeleton } from "@/components/ui/Skeleton";
import { ListingForm } from "@/components/listings/listing-form";
import { useToast } from "@/context";
import { getListing, updateListing, pushListing } from "@/lib/api/listings";
import { listingToForm, getListingFallbackImageUrl } from "@/lib/marketplace/listingToForm";
import { EBAY_LISTING_FORM_INITIAL } from "@/types/marketplace";
import type { EbayListing, EbayListingFormState } from "@/types/marketplace";
import type { EbayListingErrors } from "@/lib/validation/ebayListing";

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

  const listingProduct =
    listing && listing.product !== null && typeof listing.product === "object" ? listing.product : null;
  const productVehicle = listingProduct?.vehicle ?? null;
  const fallbackImageUrl = listing ? getListingFallbackImageUrl(listing) : undefined;

  useEffect(() => {
    if (listing) setForm(listingToForm(listing));
  }, [listing]);

  function patchForm(patch: Partial<EbayListingFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  const saveMutation = useMutation({
    mutationFn: () => updateListing(id!, form, productVehicle, fallbackImageUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listing", id] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast({ title: "Listing saved", tone: "success" });
    },
    onError: (err: Error) => toast({ title: err.message, tone: "danger" }),
  });

  const pushMutation = useMutation({
    mutationFn: async () => {
      await updateListing(id!, form, productVehicle, fallbackImageUrl);
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
        productVehicle={productVehicle}
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
