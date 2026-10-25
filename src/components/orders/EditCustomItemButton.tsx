import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EditCustomItemModal } from "@/components/orders/EditCustomItemModal";
import type { OrderItem } from "@/types/orders";

interface EditCustomItemButtonProps {
  orderId: string;
  version: number;
  item: OrderItem;
}

export function EditCustomItemButton({ orderId, version, item }: EditCustomItemButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-6 w-6 shrink-0 text-fg/45 hover:text-fg"
        onClick={() => setOpen(true)}
        aria-label={`Edit ${item.name}`}
      >
        <Pencil className="h-3 w-3" />
      </Button>
      <EditCustomItemModal open={open} onOpenChange={setOpen} orderId={orderId} version={version} item={item} />
    </>
  );
}
