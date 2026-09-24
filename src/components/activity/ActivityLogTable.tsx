import { Badge } from "@/components/ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { eventVisual, formatTime } from "@/components/activity/ActivityEventRow";
import { cn } from "@/utils/cn";
import type { ActivityEvent } from "@/types/dashboard";

// Uses eventVisual to match dashboard feed; no User/IP cols (no actor info).

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
                  <span className="block text-2xs text-fg/40">{formatTime(event.timestamp)}</span>
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
                  {event.sku ? <span className="mt-0.5 block font-mono text-2xs text-fg/40">SKU {event.sku}</span> : null}
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
