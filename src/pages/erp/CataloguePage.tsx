import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { ChannelSummaryCard } from "@/components/channels/ChannelSummaryCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProductPickerModal } from "@/components/listings/ProductPickerModal";
import { ProductsTab } from "@/components/catalogue/ProductsTab";
import { ListingsTab } from "@/components/catalogue/ListingsTab";
import { getChannels } from "@/lib/api/channels";
import { useToast } from "@/context";
import type { Product } from "@/types/product";
import { ArrowRight, Blocks, Plus, RefreshCw } from "lucide-react";

type CatalogueTab = "products" | "listings";

// The merged Products + Listings page ("Catalogue"). Fetches GET /channels
// ONCE here (shared ["channels"] query key — same one GoogleConnectCard.tsx/
// ProductEditPage.tsx already use) and passes it down to both tabs, so
// there's a single source of truth for "which channels exist" driving the
// summary cards, the Products tab's per-channel columns, and the Listings
// tab's sidebar/counts — none of them hardcode a platform list.
export default function CataloguePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pickerOpen, setPickerOpen] = useState(false);

  const activeTab: CatalogueTab = searchParams.get("tab") === "listings" ? "listings" : "products";
  const setActiveTab = (tab: CatalogueTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    }, { replace: true });
  };

  const { data, isLoading } = useQuery({
    queryKey: ["channels"],
    queryFn: getChannels,
  });
  const channels = data?.data ?? [];

  function handleProductSelected(product: Product) {
    setPickerOpen(false);
    navigate(`/listings/new?product=${product._id}&productSlug=${product.slug}`);
  }

  function openChannel(channel: (typeof channels)[number]) {
    if (channel.connection.status !== "connected") {
      navigate(`/settings/integrations/${channel.key}`);
      return;
    }
    // Same URL param ListingsTab already reads (l_platform) — clicking a
    // channel card is now a real shortcut into "show me just this channel's
    // listings", not a purely decorative status strip.
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", "listings");
      next.set("l_platform", channel.key);
      return next;
    });
  }

  function syncAll() {
    // NOTE: "Sync all" re-queues every listing already known to need
    // attention (error/price_locked) by re-invalidating the listings query
    // after nudging the user to the Needs-attention view — there's no
    // dedicated bulk-resync endpoint on the backend today, and adding one
    // is out of scope for this UI pass. Judgment call: rather than silently
    // do nothing or fake a bulk action, this surfaces exactly what a real
    // "sync all" would need to act on.
    setActiveTab("listings");
    queryClient.invalidateQueries({ queryKey: ["listings"] });
    queryClient.invalidateQueries({ queryKey: ["channels"] });
    toast({ title: "Showing listings that need a resync", tone: "success" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catalogue"
        description="One product record, many channels. Products is the source of truth; Listings is the per-channel work queue."
      >
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="md" className="gap-2" onClick={syncAll}>
            <RefreshCw className="h-4 w-4" />
            Sync all
          </Button>
          <Button
            variant="primary"
            size="md"
            className="gap-2"
            onClick={() => (activeTab === "products" ? navigate("/products/new") : setPickerOpen(true))}
          >
            <Plus className="h-4 w-4" />
            {activeTab === "products" ? "New Product" : "New Listing"}
          </Button>
        </div>
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : channels.length === 0 ? (
        // A blank strip here (the old behaviour — the grid rendered zero
        // children with nothing to explain why) reads as a bug, not as "you
        // haven't connected anything yet". This is the one place on the page
        // that says so and points at where to fix it.
        <button
          type="button"
          onClick={() => navigate("/settings/integrations")}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-left transition-colors hover:border-accent/40 hover:bg-muted/40"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
            <Blocks className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-fg">No sales channels connected</span>
            <span className="block text-xs text-fg/50">Connect eBay or Google Shopping to start listing products.</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-fg/30" />
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {channels.map((channel, i) => (
            <ChannelSummaryCard
              key={channel.key}
              channel={channel}
              index={i}
              onClick={() => openChannel(channel)}
            />
          ))}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CatalogueTab)}>
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="listings">Listings</TabsTrigger>
        </TabsList>
        <TabsContent value="products">
          <ProductsTab channels={channels} />
        </TabsContent>
        <TabsContent value="listings">
          <ListingsTab channels={channels} />
        </TabsContent>
      </Tabs>

      <ProductPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handleProductSelected} />
    </div>
  );
}
