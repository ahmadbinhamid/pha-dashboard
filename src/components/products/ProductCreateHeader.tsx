import { BreadcrumbNav } from "@/components/ui/BreadcrumbNav";
import { Button } from "@/components/ui/Button";
import { StickyPageHeader } from "@/components/shared/StickyPageHeader";

interface ProductCreateHeaderProps {
  onSaveDraft: () => void;
  onCreate: () => void;
  saving: boolean;
  uploading: boolean;
  // Lets the page measure the header to place sticky content below it.
  ref?: React.Ref<HTMLDivElement>;
}

// Sticky create header: breadcrumb plus draft and create actions.
export function ProductCreateHeader({ onSaveDraft, onCreate, saving, uploading, ref }: ProductCreateHeaderProps) {
  const busy = saving || uploading;
  return (
    <StickyPageHeader ref={ref} className="border-b border-border pb-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BreadcrumbNav items={[{ label: "Products", href: "/products" }, { label: "New product" }]} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onSaveDraft}>
            Save draft
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={busy} onClick={onCreate}>
            {saving ? "Creating…" : uploading ? "Uploading images…" : "Create product"}
          </Button>
        </div>
      </div>
    </StickyPageHeader>
  );
}
