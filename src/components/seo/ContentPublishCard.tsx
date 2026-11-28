import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { FormField } from "@/components/ui/FormField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ContentStateBadge } from "@/components/seo/ContentStateBadge";
import type { ContentState, ContentStatus } from "@/types/seo";

interface ContentPublishCardProps {
  status: ContentStatus;
  onStatusChange: (status: ContentStatus) => void;
  // Articles only; pages go live the moment they're published.
  publishedAt?: string | null;
  onPublishedAtChange?: (iso: string | null) => void;
  // Saved state, so the badge reflects what shoppers see right now.
  savedState: ContentState | null;
  liveUrl: string | null;
  canPublish: boolean;
}

const STATUS_OPTIONS = [
  { value: "draft" as const, label: "Draft" },
  { value: "published" as const, label: "Published" },
];

export function ContentPublishCard(props: ContentPublishCardProps) {
  const { status, onStatusChange, publishedAt, onPublishedAtChange, savedState, liveUrl, canPublish } = props;
  const scheduled = status === "published" && !!publishedAt && new Date(publishedAt) > new Date();

  return (
    <Card>
      <CardHeader title="Publishing" right={savedState ? <ContentStateBadge state={savedState} /> : undefined} />
      <CardContent className="space-y-4">
        <SegmentedControl options={STATUS_OPTIONS.map((o) => ({ ...o, disabled: !canPublish }))} value={status} onChange={onStatusChange} ariaLabel="Status" fullWidth />
        {!canPublish ? (
          <p className="text-xs text-fg/55">You can write and save drafts. Someone with publish access makes it live.</p>
        ) : null}
        {onPublishedAtChange ? (
          <FormField
            label="Publish date"
            hint={scheduled ? "Goes live automatically on this date." : "Blank publishes now. A future date schedules it."}
          >
            <DateTimePicker value={publishedAt ?? null} onChange={onPublishedAtChange} placeholder="Publish now" allowClear disabled={!canPublish} />
          </FormField>
        ) : null}
        {liveUrl && savedState === "published" ? (
          <Button asChild variant="secondary" className="w-full">
            <a href={liveUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              View on website
            </a>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
