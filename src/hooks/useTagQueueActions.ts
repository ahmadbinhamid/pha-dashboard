import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/context";
import {
  TAG_QUERY_KEYS,
  clearTagQueue,
  importUnprintedTags,
  removeTagQueueItem,
  updateTagQueueItem,
} from "@/lib/api/tags";
import { pluralize } from "@/utils/format";

// Queue mutations for the tag queue; printing lives in PrintTagsModal.
export function useTagQueueActions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: TAG_QUERY_KEYS.queue });
    void queryClient.invalidateQueries({ queryKey: TAG_QUERY_KEYS.history });
  };
  const onError = (title: string) => (err: Error) =>
    toast({ title, description: err.message, tone: "danger" });

  const updateCopies = useMutation({
    mutationFn: ({ id, copies }: { id: string; copies: number }) =>
      updateTagQueueItem(id, copies),
    onSuccess: refresh,
    onError: onError("Couldn't update the quantity"),
  });
  const remove = useMutation({
    mutationFn: removeTagQueueItem,
    onSuccess: refresh,
    onError: onError("Couldn't remove it"),
  });
  const clear = useMutation({
    mutationFn: clearTagQueue,
    onSuccess: () => {
      toast({ title: "Tag queue cleared", tone: "success" });
      refresh();
    },
    onError: onError("Couldn't clear the queue"),
  });
  const importUnprinted = useMutation({
    mutationFn: importUnprintedTags,
    onSuccess: (res) => {
      const { added = 0, skipped_out_of_stock = 0 } = res.data ?? {};
      toast({
        title: added
          ? `Queued ${pluralize(added, "product")} never printed`
          : "Nothing new to queue",
        description: skipped_out_of_stock
          ? `${pluralize(skipped_out_of_stock, "product")} skipped: no stock.`
          : undefined,
        tone: "success",
      });
      refresh();
    },
    onError: onError("Couldn't import unprinted products"),
  });
  const busy =
    updateCopies.isPending ||
    remove.isPending ||
    clear.isPending ||
    importUnprinted.isPending;
  return { updateCopies, remove, clear, importUnprinted, busy };
}
