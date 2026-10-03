import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AddCustomProductModal } from "@/components/pos/AddCustomProductModal";
import { cn } from "@/utils/cn";

interface AddCustomProductButtonProps {
  className?: string;
}

export function AddCustomProductButton({ className }: AddCustomProductButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size="sm" className={cn("shrink-0 gap-1.5", className)} onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Custom product
      </Button>
      <AddCustomProductModal open={open} onOpenChange={setOpen} />
    </>
  );
}
