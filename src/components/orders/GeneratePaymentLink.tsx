import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Copy, ExternalLink, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/context";
import { generatePaymentLink } from "@/lib/api/orders";

export function GeneratePaymentLink({ orderId }: { orderId: string }) {
  const { toast } = useToast();
  const [link, setLink] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => generatePaymentLink(orderId),
    onSuccess: (res) => setLink(res.data.url),
    onError: (err: Error) => {
      toast({ title: "Couldn't generate payment link", description: err.message, tone: "danger" });
    },
  });

  if (link) {
    return (
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
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="w-full gap-2"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      <LinkIcon className="h-3.5 w-3.5" />
      {mutation.isPending ? "Generating…" : "Generate Payment Link"}
    </Button>
  );
}
