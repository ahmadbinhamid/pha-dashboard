import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SkeletonText } from "@/components/ui/Skeleton";
import { Tabs, TabsContent } from "@/components/ui/Tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { AnnouncementPanel } from "@/components/storefront/AnnouncementPanel";
import { FlashSalePanel } from "@/components/storefront/FlashSalePanel";
import { HeroCarouselSettingsCard } from "@/components/storefront/HeroCarouselSettingsCard";
import { HeroSlidesPanel } from "@/components/storefront/HeroSlidesPanel";
import { DiscountsPanel } from "@/components/discounts/DiscountsPanel";
import { StorefrontPreviewDialog } from "@/components/storefront/StorefrontPreviewDialog";
import { StorefrontStatusCards } from "@/components/storefront/StorefrontStatusCards";
import { PERMISSIONS } from "@/config/permissions";
import { EMPTY_ANNOUNCEMENT, STOREFRONT_TABS } from "@/config/storefront";
import { useOrgSettings } from "@/context/orgSettings";
import { useMyAccess } from "@/hooks/useMyAccess";
import { getCategories } from "@/lib/api/categories";
import { getDomains } from "@/lib/api/domains";
import { getProducts } from "@/lib/api/products";
import { STOREFRONT_SETTINGS_QUERY_KEY, getStorefrontSettings } from "@/lib/api/storefront";
import { toPromotedSale } from "@/lib/storefront/salePricing";
import type { Announcement, HeroSettings, PromotedSale, StorefrontTab } from "@/types/storefront";

const PREVIEW_PRODUCT_COUNT = 8;
const FALLBACK_HOST = "yourstore.com.au";

export default function StorefrontPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get("tab") as StorefrontTab | null;
  const { can } = useMyAccess();
  const canEdit = can(PERMISSIONS.storefront.update);
  const canSeeDiscounts = can(PERMISSIONS.discounts.view);
  const allowed = param && STOREFRONT_TABS.includes(param) && (param !== "discounts" || canSeeDiscounts);
  const tab: StorefrontTab = allowed ? param : "hero";
  const { settings: org } = useOrgSettings();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState<Announcement | null>(null);
  const [heroSettingsDraft, setHeroSettingsDraft] = useState<HeroSettings | null>(null);
  // undefined until the sale panel reports, then its live preview (or null).
  const [salePreview, setSalePreview] = useState<PromotedSale | null | undefined>(undefined);

  const { data, isLoading } = useQuery({ queryKey: STOREFRONT_SETTINGS_QUERY_KEY, queryFn: getStorefrontSettings });
  const { data: categoriesRes } = useQuery({ queryKey: ["categories", "all"], queryFn: () => getCategories({ limit: 100 }) });
  // Preview-only data, fetched when the preview is first opened.
  const { data: productsRes } = useQuery({
    queryKey: ["products", { status: "active", page: 1, limit: PREVIEW_PRODUCT_COUNT }],
    queryFn: () => getProducts({ status: "active", page: 1, limit: PREVIEW_PRODUCT_COUNT }),
    enabled: previewOpen,
  });
  // NOTE: domains need integrations.view, else the preview shows a placeholder.
  const { data: domainsRes } = useQuery({ queryKey: ["domains"], queryFn: getDomains, retry: false, enabled: previewOpen });

  const settings = data?.data;
  const categories = categoriesRes?.data?.items ?? [];
  const host = domainsRes?.data?.find((d) => d.is_default && d.status === "active")?.hostname ?? FALLBACK_HOST;

  function setTab(next: StorefrontTab) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set("tab", next);
        return params;
      },
      { replace: true },
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storefront"
        description="Everything shoppers see on your website: hero carousel, announcement strip, discounts and their promotion."
      >
        <Button variant="secondary" onClick={() => setPreviewOpen(true)} disabled={!settings}>
          <Eye className="h-4 w-4" />
          Preview storefront
        </Button>
      </PageHeader>

      {isLoading || !settings ? (
        <SkeletonText lines={8} />
      ) : (
        <>
          <StorefrontStatusCards settings={settings} active={tab} onSelect={setTab} showDiscounts={canSeeDiscounts} />

          <Tabs value={tab} onValueChange={(v) => setTab(v as StorefrontTab)}>
            {/* forceMount keeps unsaved drafts alive across section switches. */}
            <TabsContent value="hero" forceMount className="data-[state=inactive]:hidden">
              <div className="space-y-4">
                <HeroSlidesPanel slides={settings.hero_slides} canEdit={canEdit} />
                <HeroCarouselSettingsCard settings={settings.hero_settings} canEdit={canEdit} onDraftChange={setHeroSettingsDraft} />
              </div>
            </TabsContent>
            <TabsContent value="announcement" forceMount className="data-[state=inactive]:hidden">
              <AnnouncementPanel announcement={settings.announcement} canEdit={canEdit} onDraftChange={setAnnouncementDraft} />
            </TabsContent>
            {canSeeDiscounts ? (
              <TabsContent value="discounts">
                <DiscountsPanel promotedId={settings.flash_sale.active ? settings.flash_sale.discount_id : null} />
              </TabsContent>
            ) : null}
            <TabsContent value="flash-sale" forceMount className="data-[state=inactive]:hidden">
              <FlashSalePanel
                sale={settings.flash_sale}
                featuredDiscount={settings.featured_discount}
                categories={categories}
                canEdit={canEdit}
                onPreviewChange={setSalePreview}
              />
            </TabsContent>
          </Tabs>

          <StorefrontPreviewDialog
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            content={{
              slides: settings.hero_slides,
              heroSettings: heroSettingsDraft ?? settings.hero_settings,
              announcement: announcementDraft ?? settings.announcement ?? EMPTY_ANNOUNCEMENT,
              sale: salePreview !== undefined ? salePreview : toPromotedSale(settings.flash_sale, settings.featured_discount),
            }}
            storeName={org.storeName}
            logoUrl={org.logoUrl}
            host={host}
            categories={categories}
            products={productsRes?.data?.items ?? []}
          />
        </>
      )}
    </div>
  );
}
