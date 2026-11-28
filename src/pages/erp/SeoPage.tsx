import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { ArticlesPanel } from "@/components/seo/ArticlesPanel";
import { CatalogSeoPanel } from "@/components/seo/CatalogSeoPanel";
import { PagesPanel } from "@/components/seo/PagesPanel";
import { RedirectsPanel } from "@/components/seo/RedirectsPanel";
import { SeoOverviewCards } from "@/components/seo/SeoOverviewCards";
import { SeoSettingsPanel } from "@/components/seo/SeoSettingsPanel";
import { SEO_TABS, SEO_TAB_LABEL } from "@/config/seo";
import type { SeoTab } from "@/types/seo";

export default function SeoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get("tab") as SeoTab | null;
  const tab: SeoTab = param && SEO_TABS.includes(param) ? param : "articles";

  const setTab = (next: string) =>
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set("tab", next);
        return params;
      },
      { replace: true },
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="SEO & Content"
        description="Your blog, website pages, redirects and how the store appears in Google."
      />
      <SeoOverviewCards onSelect={setTab} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="overflow-x-auto">
          {SEO_TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {SEO_TAB_LABEL[t]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="articles">
          <ArticlesPanel />
        </TabsContent>
        <TabsContent value="pages">
          <PagesPanel />
        </TabsContent>
        <TabsContent value="products">
          <CatalogSeoPanel kind="products" />
        </TabsContent>
        <TabsContent value="categories">
          <CatalogSeoPanel kind="categories" />
        </TabsContent>
        <TabsContent value="redirects">
          <RedirectsPanel />
        </TabsContent>
        <TabsContent value="settings">
          <SeoSettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
