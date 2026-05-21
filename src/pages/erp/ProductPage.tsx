import { useParams } from "react-router-dom";
import { ProductDetails } from "@/components/products/product-details";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  return <ProductDetails productId={id ?? ""} />;
}
