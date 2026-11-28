import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { CampaignsPanel } from "@/components/campaigns/CampaignsPanel";
import { ContactsPanel } from "@/components/campaigns/ContactsPanel";
import { CAMPAIGNS_TABS } from "@/config/campaigns";
import type { CampaignsTab } from "@/types/campaign";

export default function CampaignsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get("tab") as CampaignsTab | null;
  const tab: CampaignsTab = param && CAMPAIGNS_TABS.includes(param) ? param : "campaigns";

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
        title="Campaigns"
        description="Email newsletters and promotions to your website subscribers, imported contacts and opted-in customers."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>
        <TabsContent value="campaigns">
          <CampaignsPanel />
        </TabsContent>
        <TabsContent value="contacts">
          <ContactsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
