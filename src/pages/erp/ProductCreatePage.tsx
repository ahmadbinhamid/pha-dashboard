import { useQuery } from "@tanstack/react-query";
import { ProductForm } from "@/components/products/ProductForm";
import { getCategories } from "@/lib/api/categories";

// The edit page's form in create mode (no tabs until the product exists).
export default function ProductCreatePage() {
  const { data: categoriesRes } = useQuery({
    queryKey: ["categories", "all"],
    queryFn: () => getCategories({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });
  const categoryOptions = (categoriesRes?.data?.items ?? []).map((c) => ({ value: c._id, label: c.name }));

  return <ProductForm mode="create" categoryOptions={categoryOptions} />;
}
