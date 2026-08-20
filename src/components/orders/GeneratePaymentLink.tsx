import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Link as LinkIcon, MoreHorizontal, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/ActionsMenu";
import { useToast } from "@/context";
import { generatePaymentLink, sendPaymentLinkEmail } from "@/lib/api/orders";

export function GeneratePaymentLink({
  orderId,
  customerEmail,
}: {
  orderId: string;
  customerEmail?: string | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [link, setLink] = useState<string | null>(null);
  const hasCustomerEmail = !!customerEmail;

  const generateMutation = useMutation({
    mutationFn: () => generatePaymentLink(orderId),
    onSuccess: (res) => {
      setLink(res.data.url);
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't generate payment link", description: err.message, tone: "danger" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => sendPaymentLinkEmail(orderId),
    onSuccess: (res) => {
      setLink(res.data.url);
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      toast({ title: `Payment link emailed to ${customerEmail}`, tone: "success" });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't send payment link", description: err.message, tone: "danger" });
    },
  });

  if (link) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Input value={link} readOnly size="sm" className="flex-1" />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => navigator.clipboard.writeText(link).then(() => toast({ title: "Copied", tone: "success" }))}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="secondary" size="icon" asChild>
            <a href={link} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
        {hasCustomerEmail && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full gap-2"
            disabled={sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
          >
            <Send className="h-3.5 w-3.5" />
            {sendMutation.isPending ? "Sending…" : "Send by Email"}
          </Button>
        )}
      </div>
    );
  }

  // One primary action (send if we can, otherwise just generate) plus a
  // "···" menu for the alternate path — two full buttons side by side here
  // used to wrap/crowd in the narrow sidebar column this renders in.
  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="flex-1 gap-2"
        disabled={generateMutation.isPending || sendMutation.isPending}
        onClick={() => (hasCustomerEmail ? sendMutation.mutate() : generateMutation.mutate())}
      >
        <Send className="h-3.5 w-3.5" />
        {hasCustomerEmail
          ? sendMutation.isPending
            ? "Sending…"
            : "Send Payment Link"
          : generateMutation.isPending
            ? "Generating…"
            : "Generate Link"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="secondary" size="icon">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {hasCustomerEmail ? (
            <DropdownMenuItem onSelect={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              <LinkIcon className="h-3.5 w-3.5 text-fg/50" />
              {generateMutation.isPending ? "Generating…" : "Generate Link Only"}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled>
              <Send className="h-3.5 w-3.5 text-fg/50" />
              Add a customer email to send by email
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
