import { Navigate, useSearchParams } from "react-router-dom";
import { productChannelsPath } from "@/config/salesChannels";

// Retired page: redirects old links to the product's Sales Channels section.
export default function ListingCreatePage() {
  const [searchParams] = useSearchParams();
  const productSlug = searchParams.get("productSlug");
  // NOTE: links without productSlug fall back to the Products list.
  return <Navigate to={productSlug ? productChannelsPath(productSlug) : "/products"} replace />;
}
