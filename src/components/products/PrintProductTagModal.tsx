import { useState } from "react";
import { ListPlus, Printer } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/Modal";
import { TagPreview } from "@/components/tags/TagPreview";
import { PRODUCT_TAG_SIZE_MM } from "@/config/productTag";
import { useToast } from "@/context";
import { useTagStyle } from "@/hooks/useTagStyle";
import { TAG_QUERY_KEYS, addToTagQueue } from "@/lib/api/tags";
import { tagContent } from "@/lib/tags/tagPdf";
import { PrintTagsModal } from "@/components/tags/PrintTagsModal";
import type { Product } from "@/types/product";

interface PrintProductTagModalProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Create flow wording: "Product created" instead of a plain print prompt.
  justCreated?: boolean;
}

// Preview a product's tag, then print one now or queue one per unit.
export function PrintProductTagModal({
  product,
  open,
  onOpenChange,
  justCreated,
}: PrintProductTagModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { style } = useTagStyle();
  const [printOpen, setPrintOpen] = useState(false);
  const content = tagContent(product);
  const { width, height } = PRODUCT_TAG_SIZE_MM;

  const queueMutation = useMutation({
    mutationFn: () => addToTagQueue(product._id),
    onSuccess: (res) => {
      const copies = res.data?.copies ?? 1;
      toast({
        title: "Added to tag queue",
        description: `${copies} tag${copies === 1 ? "" : "s"}; print them from Tag manager.`,
        tone: "success",
      });
      void queryClient.invalidateQueries({ queryKey: TAG_QUERY_KEYS.queue });
      onOpenChange(false);
    },
    onError: (err: Error) =>
      toast({
        title: "Couldn't add to tag queue",
        description: err.message,
        tone: "danger",
      }),
  });

  // Hands off to the shared print dialog, which confirms before logging.
  function printNow() {
    onOpenChange(false);
    setPrintOpen(true);
  }

  return (
    <>
      <Modal open={open} onOpenChange={onOpenChange}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>
              {justCreated
                ? "Product created — print its tag"
                : "Print product tag"}
            </ModalTitle>
            <ModalDescription>
              {width} × {height} mm label. Print one now, or queue one per unit
              in stock and print them with the rest.
            </ModalDescription>
          </ModalHeader>

          <TagPreview content={content} style={style} className="mx-auto" />
          {!content.bay && (
            <p className="text-xs text-warn">
              No bay set yet; add one under Stock to print it on the tag.
            </p>
          )}

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              disabled={queueMutation.isPending}
              onClick={() => queueMutation.mutate()}
            >
              <ListPlus className="h-3.5 w-3.5" />
              {queueMutation.isPending ? "Adding…" : "Add to tag queue"}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="gap-1.5"
              onClick={printNow}
            >
              <Printer className="h-3.5 w-3.5" />
              Print tag
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <PrintTagsModal
        open={printOpen}
        onOpenChange={setPrintOpen}
        items={[
          {
            productId: product._id,
            label: product.sku ?? product.title,
            content,
            copies: 1,
          },
        ]}
        source="product"
        style={style}
      />
    </>
  );
}
