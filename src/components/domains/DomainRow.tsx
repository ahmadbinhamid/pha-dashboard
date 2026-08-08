import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { CopyField } from "@/components/ui/CopyField";
import { TableRow, TableCell } from "@/components/ui/Table";
import { useToast } from "@/context";
import { deleteDomain, setDefaultDomain, verifyDomain } from "@/lib/api/domains";
import { DOMAIN_STATUS_CONFIG } from "@/config/domainStatus";
import type { Domain } from "@/types/domain";
import { RefreshCw, Trash2 } from "lucide-react";

// A domain's TXT verification host is always this fixed prefix + its own
// hostname — see server/src/services/domain.service.js#getVerificationRecordName.
// Kept in sync manually (no shared package between FE/BE in this repo); if
// that prefix ever changes, update it here too.
const VERIFICATION_SUBDOMAIN = "_pha-verify";

export function DomainRow({ domain, onRequestDelete }: { domain: Domain; onRequestDelete: (domain: Domain) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDnsInfo, setShowDnsInfo] = useState(domain.status === "pending");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["domains"] });

  const verifyMutation = useMutation({
    mutationFn: () => verifyDomain(domain._id),
    onSuccess: (res) => {
      if (res.data.verified) {
        toast({ title: "Domain verified", tone: "success" });
        setShowDnsInfo(false);
      } else {
        toast({
          title: "Not verified yet",
          description: "The DNS record wasn't found — changes can take a while to propagate.",
          tone: "warning",
        });
      }
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Verification failed", description: err.message, tone: "danger" }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: () => setDefaultDomain(domain._id),
    onSuccess: () => {
      toast({ title: "Default domain updated", tone: "success" });
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Couldn't set as default", description: err.message, tone: "danger" }),
  });

  const statusConfig = DOMAIN_STATUS_CONFIG[domain.status];

  return (
    <>
      <TableRow>
        <TableCell className="font-medium text-fg">{domain.hostname}</TableCell>
        <TableCell>
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
        </TableCell>
        <TableCell>
          <Switch
            checked={domain.is_default}
            onCheckedChange={() => setDefaultMutation.mutate()}
            disabled={domain.is_default || domain.status !== "active" || setDefaultMutation.isPending}
          />
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <div className="flex justify-end gap-1">
            {domain.status !== "active" && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => (showDnsInfo ? verifyMutation.mutate() : setShowDnsInfo(true))}
                disabled={verifyMutation.isPending}
              >
                <RefreshCw className={verifyMutation.isPending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                {showDnsInfo ? "Check again" : "Verify"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRequestDelete(domain)}
              disabled={domain.is_default}
              title={domain.is_default ? "Set another domain as default first" : undefined}
            >
              <Trash2 className="h-3.5 w-3.5 text-danger" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {showDnsInfo && domain.status !== "active" && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={4} className="bg-card">
            <div className="space-y-3 py-1 text-sm">
              <p className="text-fg/65">
                Add this TXT record at your DNS provider, then check again — it can take a few minutes (sometimes
                longer) to propagate.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-fg/45">Host</div>
                  <CopyField value={`${VERIFICATION_SUBDOMAIN}.${domain.hostname}`} />
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-fg/45">Value</div>
                  <CopyField value={domain.verification_token} />
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
