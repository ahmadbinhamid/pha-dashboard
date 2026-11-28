import { Card, CardHeader } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { CampaignRunStatusBadge } from "@/components/campaigns/CampaignRunStatusBadge";
import { formatDateTime } from "@/lib/campaigns/campaignForm";
import type { CampaignRun } from "@/types/campaign";

export function CampaignRunsTable({ runs }: { runs: CampaignRun[] }) {
  if (!runs.length) return null;
  return (
    <Card>
      <CardHeader title="Send history" description="Each send freezes the content as it was at that moment." />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Recipients</TableHead>
              <TableHead className="text-right">Sent</TableHead>
              <TableHead className="text-right">Failed</TableHead>
              <TableHead className="text-right">Skipped</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run._id}>
                <TableCell className="text-fg/70">{formatDateTime(run.started_at)}</TableCell>
                <TableCell>
                  <CampaignRunStatusBadge status={run.status} />
                  {run.error ? <div className="mt-1 text-xs text-danger">{run.error}</div> : null}
                </TableCell>
                <TableCell className="text-right text-fg/70">{run.total || "—"}</TableCell>
                <TableCell className="text-right text-fg/70">{run.sent}</TableCell>
                <TableCell className={run.failed ? "text-right text-danger" : "text-right text-fg/70"}>{run.failed}</TableCell>
                <TableCell className="text-right text-fg/70">{run.skipped}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
