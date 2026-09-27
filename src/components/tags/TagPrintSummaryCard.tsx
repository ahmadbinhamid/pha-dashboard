import { Layers, Palette, Printer, Tags } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { TagPreview } from "@/components/tags/TagPreview";
import { Can } from "@/components/auth/Can";
import { PERMISSIONS } from "@/config/permissions";
import { PRODUCT_TAG_SIZE_MM } from "@/config/productTag";
import type { TagContent, TagQueueItem, TagStyle } from "@/types/tags";

interface TagPrintSummaryCardProps {
  items: TagQueueItem[];
  preview: TagContent;
  previewLabel: string;
  style: TagStyle;
  onPrintAll: () => void;
  onEditStyle: () => void;
  busy: boolean;
}

// Sticky "ready to print" panel: live tag preview, totals, Print all.
export function TagPrintSummaryCard({
  items,
  preview,
  previewLabel,
  style,
  onPrintAll,
  onEditStyle,
  busy,
}: TagPrintSummaryCardProps) {
  const totalTags = items.reduce((sum, i) => sum + i.copies, 0);
  const { width, height } = PRODUCT_TAG_SIZE_MM;

  return (
    <Card className="lg:sticky lg:top-6">
      <CardHeader
        title="Ready to print"
        description={`${width} × ${height} mm · one PDF, one tag per page`}
      />
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center gap-2 rounded-xl bg-bg-2 px-3 py-5">
          <TagPreview content={preview} style={style} />
          <p className="max-w-full truncate text-xs text-fg/55">
            {previewLabel}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Layers} label="Products">
            {items.length}
          </StatCard>
          <StatCard icon={Tags} label="Tags">
            {totalTags}
          </StatCard>
        </div>

        <Can permission={PERMISSIONS.tags.print}>
          <Button type="button" variant="primary" size="md" className="w-full gap-2" disabled={busy || !items.length} onClick={onPrintAll}>
            <Printer className="h-4 w-4" />
            Print all tags{totalTags ? ` (${totalTags})` : ""}
          </Button>
        </Can>
        <Can permission={PERMISSIONS.tags.update}>
          <Button type="button" variant="ghost" size="sm" className="w-full gap-1.5 text-fg/60" onClick={onEditStyle}>
            <Palette className="h-3.5 w-3.5" />
            Customise tag style
          </Button>
        </Can>
      </CardContent>
    </Card>
  );
}
