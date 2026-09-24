import { ChevronDown, Circle, Mail } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { BreadcrumbNav } from "@/components/ui/BreadcrumbNav";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/ActionsMenu";
import { AddToCartButton } from "@/components/pos/AddToCartButton";
import { StickyPageHeader } from "@/components/shared/StickyPageHeader";
import type { Product } from "@/types/product";

const STATUS_OPTIONS: { value: Product["status"]; label: string; hint: string }[] = [
  { value: "active", label: "Active", hint: "Visible and sellable now" },
  { value: "draft", label: "Draft", hint: "Hidden everywhere until activated" },
];

interface ProductEditHeaderProps {
  product: Product;
  onStatusChange: (status: Product["status"]) => void;
  statusPending: boolean;
  // Header chip summarising channel sync health.
  channelChip: React.ReactNode;
  isDirty: boolean;
  onDiscard: () => void;
  onSave: () => void;
  saving: boolean;
  uploading: boolean;
  onSendEmail: () => void;
  // Tab bar, kept sticky together with the header.
  children: React.ReactNode;
  // Lets the page measure the header to place sticky content below it.
  ref?: React.Ref<HTMLDivElement>;
}

// Sticky product header: breadcrumb, status, channel health, save and tab bar.
export function ProductEditHeader({
  product,
  onStatusChange,
  statusPending,
  channelChip,
  isDirty,
  onDiscard,
  onSave,
  saving,
  uploading,
  onSendEmail,
  children,
  ref,
}: ProductEditHeaderProps) {
  const active = product.status === "active";

  return (
    <StickyPageHeader ref={ref} className="border-b border-border">
      <div className="flex min-h-14 flex-wrap items-center gap-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <BreadcrumbNav className="min-w-0" items={[{ label: "Products", href: "/products" }, { label: product.title }]} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" disabled={statusPending} className="shrink-0 outline-none! focus-visible:ring-2 focus-visible:ring-ring rounded-full">
                <Badge variant={active ? "ok" : "warn"} className="cursor-pointer">
                  {active ? "Active" : "Draft"}
                  <ChevronDown className="h-3 w-3" />
                </Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {STATUS_OPTIONS.map((o) => (
                <DropdownMenuItem key={o.value} disabled={o.value === product.status} onSelect={() => onStatusChange(o.value)}>
                  <div>
                    <p className="text-sm">{o.label}</p>
                    <p className="text-xs text-fg/55">{o.hint}</p>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {channelChip}
          {isDirty && (
            <>
              <span className="inline-flex items-center gap-1.5 text-xs text-warn">
                <Circle className="h-2.5 w-2.5 fill-current" />
                Unsaved changes
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
                Discard
              </Button>
            </>
          )}
          <div className="flex items-center">
            <AddToCartButton product={product} display="labeled" className="rounded-r-none" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-9 w-7 rounded-l-none border-l border-border px-0"
                  aria-label="More cart actions"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onSendEmail}>
                  <Mail className="h-3.5 w-3.5 text-fg/50" />
                  Send email
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button type="button" variant="primary" size="sm" disabled={!isDirty || saving || uploading} onClick={onSave}>
            {saving ? "Saving…" : uploading ? "Uploading images…" : "Save"}
          </Button>
        </div>
      </div>
      {children}
    </StickyPageHeader>
  );
}
