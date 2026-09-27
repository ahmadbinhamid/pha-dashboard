import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { TAG_QUERY_KEYS, getTagHistory } from "@/lib/api/tags";
import { formatRelativeTime } from "@/utils/format";
import type { TagPrintLog } from "@/types/tags";

const PAGE_SIZE = 20;
const SOURCE_LABEL: Record<TagPrintLog["source"], string> = {
  queue: "Queue",
  product: "Product page",
};

// "PHA-000029 ×3, PHA-000031 ×1 +2 more"
function summarise(log: TagPrintLog) {
  const shown = log.items
    .slice(0, 2)
    .map((i) => `${i.sku ?? i.title} ×${i.copies}`);
  const rest = log.items.length - shown.length;
  return `${shown.join(", ")}${rest > 0 ? ` +${rest} more` : ""}`;
}

// Past print runs, newest first; pending tags live in the queue.
export function TagPrintHistory({ pendingTags }: { pendingTags: number }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: [...TAG_QUERY_KEYS.history, page],
    queryFn: () => getTagHistory({ page, limit: PAGE_SIZE }),
  });
  const history = data?.data;
  const logs = history?.items ?? [];

  return (
    <Card>
      <CardHeader
        title="Print history"
        description="Every tag run sent to the printer."
        right={
          <Badge variant={pendingTags > 0 ? "warn" : "muted"}>
            {pendingTags} pending in queue
          </Badge>
        }
      />
      {isLoading ? (
        <div className="space-y-2 p-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nothing printed yet"
          description="Confirmed print runs appear here."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Printed</TableHead>
                <TableHead>By</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Products</TableHead>
                <TableHead className="text-right">Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log._id}>
                  <TableCell
                    className="whitespace-nowrap text-sm"
                    title={new Date(log.created_at).toLocaleString("en-AU")}
                  >
                    {formatRelativeTime(log.created_at)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.printed_by ?? <span className="text-fg/40">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="muted">{SOURCE_LABEL[log.source]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-fg/70">
                    {summarise(log)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">
                    {log.total_tags}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {history && history.totalPages > 1 && (
            <Pagination
              className="border-t border-border px-4 py-3"
              currentPage={page}
              totalPages={history.totalPages}
              totalItems={history.total}
              itemsPerPage={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </Card>
  );
}
