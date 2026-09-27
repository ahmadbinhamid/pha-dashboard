import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Clock, Layers, Tags } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { TagComingSoonCard } from "@/components/tags/TagComingSoonCard";
import { TagPrintHistory } from "@/components/tags/TagPrintHistory";
import { TagPrintSummaryCard } from "@/components/tags/TagPrintSummaryCard";
import { TagQueuePanel } from "@/components/tags/TagQueuePanel";
import { TagStyleEditor } from "@/components/tags/TagStyleEditor";
import { productTagDeepLink } from "@/config/productTag";
import { useTagQueueActions } from "@/hooks/useTagQueueActions";
import { useTagStyle } from "@/hooks/useTagStyle";
import { TAG_QUERY_KEYS, getTagHistory, getTagQueue } from "@/lib/api/tags";
import { queuePrintItem, tagContent } from "@/lib/tags/tagPdf";
import type { TagContent, TagQueueItem } from "@/types/tags";
import { PrintTagsModal } from "@/components/tags/PrintTagsModal";
import { formatRelativeTime } from "@/utils/format";

const TABS = [
  "products",
  "shelves",
  "categories",
  "custom",
  "history",
  "style",
] as const;
type TagTab = (typeof TABS)[number];

// Preview content while the queue is empty.
const SAMPLE_TAG: TagContent = {
  link: productTagDeepLink("000000000000000000000000"),
  title: "Front brake pad set, ceramic, low dust",
  note: "Box slightly damaged, parts fine.",
  stockNumber: "PHA-000123",
  bay: "A3-02",
};

export default function TagManagerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get("tab") as TagTab | null;
  const tab: TagTab = param && TABS.includes(param) ? param : "products";
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { style } = useTagStyle();
  const actions = useTagQueueActions();
  // Rows being printed; null while the print dialog is closed.
  const [printing, setPrinting] = useState<TagQueueItem[] | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: TAG_QUERY_KEYS.queue,
    queryFn: getTagQueue,
  });
  const { data: latest } = useQuery({
    queryKey: [...TAG_QUERY_KEYS.history, "latest"],
    queryFn: () => getTagHistory({ page: 1, limit: 1 }),
  });
  const queue = data?.data ?? [];
  const pendingTags = queue.reduce((sum, i) => sum + i.copies, 0);
  const lastPrint = latest?.data?.items[0];
  const selected = queue.find((i) => i._id === selectedId) ?? queue[0];

  function setTab(next: string) {
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
        title="Tag manager"
        description="Queue, print and track shelf tags for your whole inventory."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Tags} label="Tags to print">
          {pendingTags}
        </StatCard>
        <StatCard icon={Layers} label="Products queued">
          {queue.length}
        </StatCard>
        <StatCard icon={Clock} label="Last printed">
          {lastPrint
            ? `${formatRelativeTime(lastPrint.created_at)} · ${lastPrint.total_tags} tags`
            : "Never"}
        </StatCard>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="products">
            Product tags
            {pendingTags > 0 && (
              <Badge variant="warn" className="px-1.5 py-0 text-2xs">
                {pendingTags}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="shelves">Bay &amp; shelf</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="style">Tag style</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <div className="grid items-start gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TagQueuePanel
                items={queue}
                isLoading={isLoading}
                actions={actions}
                selectedId={selected?._id ?? null}
                onSelect={setSelectedId}
                onPrint={(item) => setPrinting([item])}
              />
            </div>
            <TagPrintSummaryCard
              items={queue}
              preview={selected ? tagContent(selected.product) : SAMPLE_TAG}
              previewLabel={
                selected
                  ? `Previewing ${selected.product.sku ?? selected.product.title}`
                  : "Sample tag"
              }
              style={style}
              busy={actions.busy}
              onPrintAll={() => setPrinting(queue)}
              onEditStyle={() => setTab("style")}
            />
          </div>
        </TabsContent>
        <TabsContent value="shelves">
          <TagComingSoonCard
            title="Bay & shelf tags"
            description="Tags for the shelves and bays themselves, so a scan shows everything stored there."
          />
        </TabsContent>
        <TabsContent value="categories">
          <TagComingSoonCard
            title="Category tags"
            description="Tags for category sections of the warehouse."
          />
        </TabsContent>
        <TabsContent value="custom">
          <TagComingSoonCard
            title="Custom tags"
            description="Free form tags with your own text and layout."
          />
        </TabsContent>
        <TabsContent value="history">
          <TagPrintHistory pendingTags={pendingTags} />
        </TabsContent>
        <TabsContent value="style">
          <TagStyleEditor
            style={style}
            sample={selected ? tagContent(selected.product) : SAMPLE_TAG}
          />
        </TabsContent>
      </Tabs>

      <PrintTagsModal
        open={!!printing}
        onOpenChange={(open) => !open && setPrinting(null)}
        items={(printing ?? []).map(queuePrintItem)}
        source="queue"
        style={style}
      />
    </div>
  );
}
