import { useState } from "react";
import { ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { TagProductSearch } from "@/components/tags/TagProductSearch";
import { TagQueueActionsMenu } from "@/components/tags/TagQueueActionsMenu";
import { TagQueueRow } from "@/components/tags/TagQueueRow";
import { PERMISSIONS } from "@/config/permissions";
import { useMyAccess } from "@/hooks/useMyAccess";
import type { useTagQueueActions } from "@/hooks/useTagQueueActions";
import type { TagQueueItem } from "@/types/tags";
import { pluralize } from "@/utils/format";

interface TagQueuePanelProps {
  items: TagQueueItem[];
  isLoading: boolean;
  actions: ReturnType<typeof useTagQueueActions>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPrint: (item: TagQueueItem) => void;
}

// Search + actions on top, then every queued product and its tag count.
export function TagQueuePanel({ items, isLoading, actions, selectedId, onSelect, onPrint }: TagQueuePanelProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<TagQueueItem | null>(null);
  const { busy } = actions;
  const { can } = useMyAccess();
  const canUpdate = can(PERMISSIONS.tags.update);
  const canPrint = can(PERMISSIONS.tags.print);

  return (
    <Card>
      <CardHeader title="Tag queue" description="Find a product to queue its tags, or import everything never printed." className="border-b-0 pb-0" />
      {canUpdate && (
        <CardContent className="border-b border-border">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <TagProductSearch queue={items} />
            </div>
            <TagQueueActionsMenu
              onImportUnprinted={() => actions.importUnprinted.mutate()}
              onClear={() => setConfirmClear(true)}
              canClear={items.length > 0}
              disabled={busy}
            />
          </div>
        </CardContent>
      )}

      {isLoading ? (
        <div className="space-y-2 p-5">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="The tag queue is empty"
          description="Search a product above, choose Actions › Import all products never printed, or queue tags when creating a product."
        />
      ) : (
        // Clips row highlights to the card's rounded bottom corners.
        <div className="overflow-hidden rounded-b-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>In stock</TableHead>
                <TableHead>Tags to print</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TagQueueRow
                  key={item._id}
                  item={item}
                  selected={item._id === selectedId}
                  onSelect={() => onSelect(item._id)}
                  disabled={busy}
                  canUpdate={canUpdate}
                  canPrint={canPrint}
                  onCopiesChange={(copies) => actions.updateCopies.mutate({ id: item._id, copies })}
                  onPrint={() => onPrint(item)}
                  onRemove={() => setPendingRemove(item)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmModal
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear the tag queue?"
        description={`All ${pluralize(items.length, "product")} will be removed. Nothing is printed.`}
        confirmLabel="Clear queue"
        tone="danger"
        confirming={actions.clear.isPending}
        onConfirm={() => actions.clear.mutate(undefined, { onSettled: () => setConfirmClear(false) })}
      />
      <ConfirmModal
        open={!!pendingRemove}
        onOpenChange={(open) => !open && setPendingRemove(null)}
        title="Remove from tag queue?"
        description={
          pendingRemove
            ? `${pendingRemove.product.sku ?? pendingRemove.product.title} and its ${pluralize(pendingRemove.copies, "tag")} will be removed. Nothing is printed.`
            : undefined
        }
        confirmLabel="Remove"
        tone="danger"
        confirming={actions.remove.isPending}
        onConfirm={() => pendingRemove && actions.remove.mutate(pendingRemove._id, { onSettled: () => setPendingRemove(null) })}
      />
    </Card>
  );
}
