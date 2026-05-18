import type { Metadata } from "next";
import { AddProductForm } from "@/components/inventory/add-product-form";

export const metadata: Metadata = {
  title: "Add product",
  description: "Add a part to inventory and prepare eBay Motors listing details.",
};

export default function InventoryNewProductPage() {
  return <AddProductForm />;
}
