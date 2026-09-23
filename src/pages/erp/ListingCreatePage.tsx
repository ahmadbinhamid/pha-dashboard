import { Navigate, useSearchParams } from "react-router-dom";
import { productChannelsPath } from "@/config/salesChannels";

// Retired: listing now happens in the product form's Sales Channels section. The route stays
// so existing bookmarks/links (/listings/new?product=…&productSlug=…) redirect instead of 404ing.
export default function ListingCreatePage() {
  const [searchParams] = useSearchParams();
  const productSlug = searchParams.get("productSlug");
  // NOTE: every link this app ever generated carried productSlug; a bare ?product=<id> has no
  // slug lookup endpoint, so it falls back to the Products list rather than guessing.
  return <Navigate to={productSlug ? productChannelsPath(productSlug) : "/products"} replace />;
}
