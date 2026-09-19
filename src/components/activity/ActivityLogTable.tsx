import { Badge } from "@/components/ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { eventVisual, formatTime } from "@/components/activity/ActivityEventRow";
import { cn } from "@/utils/cn";
import type { ActivityEvent } from "@/types/dashboard";

// The audit trail as a table rather than a feed — same columns the reference
// design uses (when, what, the detail, and a trailing column), reading the
// event's icon and tone through eventVisual so this and the dashboard's
// compact feed can't drift apart.
//
// The reference also has User and IP Address columns. Nothing records either:
// ActivityEvent carries no actor and no request metadata (see
// dashboard.service.js, which derives events from orders and stock history).
// Columns that would print "—" on every row for the life of the feature earn
// their place once that's captured, not before — so the trailing column shows
// the event's own tags instead.

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function ActivityLogTable({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-160">
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">When</TableHead>
            <TableHead className="w-56">Event</TableHead>
            <TableHead>Details</TableHead>
            <TableHead className="text-right">Tags</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {events.map((event) => {
            const { icon: Icon, style } = eventVisual(event);
            return (
              <TableRow key={event.id}>
                <TableCell className="whitespace-nowrap text-fg/55">
                  <span className="block">{formatDate(event.timestamp)}</span>
                  <span className="block text-[11px] text-fg/40">{formatTime(event.timestamp)}</span>
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", style)}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="font-semibold text-fg">{event.title}</span>
                  </div>
                </TableCell>

                <TableCell className="text-fg/70">
                  <span>{event.description}</span>
                  {event.sku ? <span className="mt-0.5 block font-mono text-[11px] text-fg/40">SKU {event.sku}</span> : null}
                </TableCell>

                <TableCell className="text-right">
                  {event.tags.length > 0 ? (
                    <div className="flex flex-wrap justify-end gap-1">
                      {event.tags.map((tag) => (
                        <Badge key={tag} variant="muted">
                          {tag.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-fg/30">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
