import { Suspense } from "react";
import { Link } from "react-router-dom";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { buttonClassName } from "@/components/ui/button-styles";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { Icons } from "@/components/ui/icons";
import { useToast } from "@/context";

export default function InventoryPage() {
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm ring-1 ring-inset ring-border/50 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-fg">Inventory</h1>
            <p className="mt-1 max-w-2xl text-sm text-fg/70">
              Search and manage stock, import in bulk, or sync with your channels (eBay, warehouse, CSV).
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            <Link
              to="/inventory/new"
              className={cn(
                buttonClassName({ variant: "primary", size: "md" }),
                "inline-flex w-full items-center justify-center gap-2 sm:w-auto",
              )}
            >
              <Icons.Plus className="h-4 w-4" />
              Add product
            </Link>
            <Link
              to="/inventory/bundles"
              className={cn(
                buttonClassName({ variant: "secondary", size: "md" }),
                "inline-flex w-full items-center justify-center gap-2 sm:w-auto",
              )}
            >
              <Icons.Tag className="h-4 w-4" />
              Bundles
            </Link>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full gap-2 sm:w-auto"
              onClick={() =>
                toast({
                  tone: "default",
                  title: "Bulk import",
                  description: "CSV/XLSX import wizard will open here when connected.",
                })
              }
            >
              <Icons.Upload className="h-4 w-4" />
              Bulk import
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full gap-2 sm:w-auto"
              onClick={() =>
                toast({
                  tone: "success",
                  title: "Inventory sync",
                  description: "Queued sync with warehouse & eBay (demo — connect integrations).",
                })
              }
            >
              <Icons.Sync className="h-4 w-4" />
              Sync inventory
            </Button>
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-fg/60">
            Loading inventory…
          </div>
        }
      >
        <InventoryTable />
      </Suspense>
    </div>
  );
}
