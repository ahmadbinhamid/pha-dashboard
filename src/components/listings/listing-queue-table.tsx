"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useListingQueue } from "@/components/listings/listing-queue-store";

function StatusBadge({ status }: { status: "queued" | "published" | "error" }) {
  if (status === "queued") return <Badge variant="warn">Queued</Badge>;
  if (status === "published") return <Badge variant="ok">Published</Badge>;
  return <Badge variant="danger">Error</Badge>;
}

export function ListingQueueTable() {
  const { items, markPublished, markError, reset } = useListingQueue();

  return (
    <Card>
      <CardHeader
        title="eBay publish queue"
        description="Demo queue. Replace with a background job worker when eBay is connected."
        right={
          items.length ? (
            <Button variant="secondary" size="sm" onClick={reset}>
              Clear
            </Button>
          ) : null
        }
      />
      <CardContent className="px-0 py-0">
        {items.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-bg-2/60">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                    Item
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                    Type
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((i) => (
                  <tr key={i.id} className="transition-colors hover:bg-bg-2/30">
                    <td className="px-5 py-3">
                      <div className="text-sm font-semibold">{i.title}</div>
                      <div className="text-xs text-fg/60">{new Date(i.createdAt).toLocaleString("en-AU")}</div>
                    </td>
                    <td className="px-5 py-3 text-sm text-fg/70">{i.type}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={i.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button variant="secondary" size="sm" onClick={() => markPublished(i.id)} disabled={i.status === "published"}>
                          Mark published
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => markError(i.id)} disabled={i.status === "error"}>
                          Mark error
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-10 text-center text-sm text-fg/65">No queued items yet.</div>
        )}
      </CardContent>
    </Card>
  );
}

