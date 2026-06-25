import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { ListingForm } from "@/components/listings/listing-form";
import { useToast } from "@/context";
import { createListing, pushListing } from "@/lib/api/listings";
import { getProduct } from "@/lib/api/products";
import { EBAY_LISTING_FORM_INITIAL } from "@/types/marketplace";
import type { EbayListingFormState } from "@/types/marketplace";

export default function ListingCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const productId = searchParams.get("product") || "";
  const productSlug = searchParams.get("productSlug") || "";

  const [form, setForm] = useState<EbayListingFormState>({
    ...EBAY_LISTING_FORM_INITIAL,
    product_id: productId,
  });

  const { data: productData } = useQuery({
    queryKey: ["product-prefill", productSlug],
    queryFn: () => getProduct(productSlug),
    enabled: !!productSlug,
  });

  useEffect(() => {
    const p = productData?.data;
    if (!p) return;
    setForm((prev) => ({
      ...prev,
      product_id: p._id,
      title_override: p.title,
      store_sku: p.sku || "",
      price_override: p.price != null ? String(p.price) : "",
      ebay_category_id: p.ebay_category_id || "",
    }));
  }, [productData]);

  function patchForm(patch: Partial<EbayListingFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  const createMutation = useMutation({
    mutationFn: createListing,
    onSuccess: (res) => {
      toast({ title: "Listing saved", tone: "success" });
      navigate(`/listings/${res.data._id}/edit`);
    },
    onError: (err: Error) => {
      toast({ title: err.message, tone: "danger" });
    },
  });

  const pushMutation = useMutation({
    mutationFn: async () => {
      const res = await createListing(form);
      await pushListing(res.data._id);
      return res;
    },
    onSuccess: (res) => {
      toast({ title: "Listing queued for eBay sync", tone: "success" });
      navigate(`/listings/${res.data._id}/edit`);
    },
    onError: (err: Error) => {
      toast({ title: err.message, tone: "danger" });
    },
  });

  return (
    <div className="space-y-6">
      <BreadcrumbNav
        items={[
          { label: "Listings", href: "/listings" },
          { label: "New eBay Listing" },
        ]}
      />

      <div>
        <h1 className="text-xl font-semibold tracking-tight">New eBay Listing</h1>
        <p className="mt-1 text-sm text-fg/70">
          Create a new eBay listing and optionally push it live.
        </p>
      </div>

      <ListingForm
        form={form}
        onChange={patchForm}
        listing={null}
        onSaveDraft={() => createMutation.mutate(form)}
        onPush={() => pushMutation.mutate()}
        saving={createMutation.isPending}
        pushing={pushMutation.isPending}
        isEdit={false}
      />
    </div>
  );
}
