import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { TagPreview } from "@/components/tags/TagPreview";
import { PRODUCT_TAG_SIZE_MM } from "@/config/productTag";
import { useToast } from "@/context";
import { TAG_QUERY_KEYS, recordTagPrint } from "@/lib/api/tags";
import { printTags } from "@/lib/tags/tagPdf";
import type { TagPrintItem, TagPrintSource, TagStyle } from "@/types/tags";
import { pluralize } from "@/utils/format";

const LISTED_ITEMS = 4;

interface PrintTagsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: TagPrintItem[];
  source: TagPrintSource;
  style: TagStyle;
}

// Review, print, then confirm; nothing is logged or dequeued until confirmed.
export function PrintTagsModal({ open, onOpenChange, items, source, style }: PrintTagsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [printed, setPrinted] = useState(false);
  useEffect(() => {
    if (open) setPrinted(false);
  }, [open]);

  const totalTags = items.reduce((sum, i) => sum + i.copies, 0);
  const fromQueue = source === "queue";

  const confirmMutation = useMutation({
    mutationFn: () => recordTagPrint(source, items.map((i) => ({ product_id: i.productId, copies: i.copies }))),
    onSuccess: () => {
      toast({ title: `${pluralize(totalTags, "tag")} marked as printed`, description: "Moved to print history.", tone: "success" });
      void queryClient.invalidateQueries({ queryKey: TAG_QUERY_KEYS.queue });
      void queryClient.invalidateQueries({ queryKey: TAG_QUERY_KEYS.history });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ title: "Couldn't mark them as printed", description: err.message, tone: "danger" }),
  });

  function print() {
    printTags(items.map((i) => ({ content: i.content, copies: i.copies })), style);
    setPrinted(true);
  }

  return (
    <Modal open={open} onOpenChange={(next) => !confirmMutation.isPending && onOpenChange(next)}>
      <ModalContent className="max-w-lg">
        {!printed ? (
          <>
            <ModalHeader>
              <ModalTitle>Print {pluralize(totalTags, "tag")}?</ModalTitle>
              <ModalDescription>
                {pluralize(items.length, "product")} · {PRODUCT_TAG_SIZE_MM.width} × {PRODUCT_TAG_SIZE_MM.height} mm labels, one per page.
              </ModalDescription>
            </ModalHeader>
            <div className="space-y-3 pt-2">
              {items[0] && (
                <div className="flex justify-center rounded-xl bg-bg-2 px-4 py-5">
                  <TagPreview content={items[0].content} style={style} />
                </div>
              )}
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="flex items-center justify-between bg-bg-2 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-fg/55">
                  <span>Product</span>
                  <span>Tags</span>
                </div>
                <ul className="divide-y divide-border">
                  {items.slice(0, LISTED_ITEMS).map((i) => (
                    <li key={i.productId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="truncate font-medium text-fg">{i.label}</span>
                      <span className="shrink-0 tabular-nums text-fg/70">{i.copies}</span>
                    </li>
                  ))}
                  {items.length > LISTED_ITEMS && (
                    <li className="px-3 py-2 text-xs text-fg/55">+{pluralize(items.length - LISTED_ITEMS, "more product")}</li>
                  )}
                </ul>
              </div>
            </div>
            <ModalFooter>
              <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" size="sm" className="gap-1.5" disabled={!items.length} onClick={print}>
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>
            </ModalFooter>
          </>
        ) : (
          <>
            <ModalHeader>
              <ModalTitle>Did the tags print correctly?</ModalTitle>
              <ModalDescription>
                Confirming moves {pluralize(totalTags, "tag")} to print history{fromQueue ? " and out of the queue" : ""}. If the
                printer jammed or you cancelled, keep them{fromQueue ? " queued" : ""} and try again.
              </ModalDescription>
            </ModalHeader>
            <ModalFooter className="sm:items-center sm:justify-between">
              <Button type="button" variant="ghost" size="sm" className="gap-1.5 whitespace-nowrap" disabled={confirmMutation.isPending} onClick={print}>
                <RotateCcw className="h-3.5 w-3.5" />
                Print again
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="secondary" size="sm" className="whitespace-nowrap" disabled={confirmMutation.isPending} onClick={() => onOpenChange(false)}>
                  {fromQueue ? "Keep in queue" : "Not printed"}
                </Button>
                <Button type="button" variant="primary" size="sm" className="gap-1.5 whitespace-nowrap" disabled={confirmMutation.isPending} onClick={() => confirmMutation.mutate()}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {confirmMutation.isPending ? "Saving…" : "Yes, printed"}
                </Button>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
