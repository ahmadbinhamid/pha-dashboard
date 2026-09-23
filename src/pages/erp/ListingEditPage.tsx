import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/Skeleton";
import { getListing } from "@/lib/api/listings";
import { productChannelsPath } from "@/config/salesChannels";

// Retired: a listing is edited in its product's Sales Channels section. The route stays so
// existing bookmarks/links (/listings/:id/edit) land on that channel's panel instead of 404ing.
export default function ListingEditPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useQuery({ queryKey: ["listing", id], queryFn: () => getListing(id!), enabled: !!id });

  if (isLoading) return <Skeleton className="h-8 w-64" />;

  const listing = data?.data;
  const slug = listing && listing.product && typeof listing.product === "object" ? listing.product.slug : null;
  if (isError || !listing || !slug) return <Navigate to="/listings" replace />;
  return <Navigate to={productChannelsPath(slug, listing.platform)} replace />;
}
