import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/Skeleton";
import { getListing } from "@/lib/api/listings";
import { productChannelsPath } from "@/config/salesChannels";

// Retired page: redirects old links to the product's channel panel.
export default function ListingEditPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useQuery({ queryKey: ["listing", id], queryFn: () => getListing(id!), enabled: !!id });

  if (isLoading) return <Skeleton className="h-8 w-64" />;

  const listing = data?.data;
  const slug = listing && listing.product && typeof listing.product === "object" ? listing.product.slug : null;
  if (isError || !listing || !slug) return <Navigate to="/listings" replace />;
  return <Navigate to={productChannelsPath(slug, listing.platform)} replace />;
}
