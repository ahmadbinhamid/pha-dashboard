import { UserX } from "lucide-react";

export function CustomerNotFoundState() {
  return (
    <div className="py-20 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xs border border-border bg-bg-2">
        <UserX className="h-8 w-8 text-fg/30" />
      </div>
      <p className="font-medium text-fg">Customer not found</p>
      <p className="mt-1 text-sm text-fg/50">This customer may have been removed, or the link is incorrect.</p>
    </div>
  );
}
