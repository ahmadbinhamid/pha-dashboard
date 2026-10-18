import { Plus, Users } from "lucide-react";
import { Can } from "@/components/auth/Can";
import { Button } from "@/components/ui/Button";
import { PERMISSIONS } from "@/config/permissions";

export function CustomersEmptyState({ search, onNew }: { search: string; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-xs border border-border bg-bg-2">
        <Users className="h-8 w-8 text-fg/30" />
      </div>
      <div>
        <p className="font-medium text-fg">{search ? "No customers found" : "No customers yet"}</p>
        <p className="mt-1 text-sm text-fg/50">
          {search ? `No results for "${search}". Try a different term` : "Create your first customer to get started"}
        </p>
      </div>
      {!search && (
        <Can permission={PERMISSIONS.customers.create}>
          <Button variant="primary" size="sm" className="mt-1 gap-1.5" onClick={onNew}>
            <Plus className="h-3.5 w-3.5" />
            New Customer
          </Button>
        </Can>
      )}
    </div>
  );
}
