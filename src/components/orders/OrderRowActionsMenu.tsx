import {
  DropdownMenu,
  ActionsMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/ActionsMenu";
import { Eye } from "lucide-react";

export function OrderRowActionsMenu({ onView }: { onView: () => void }) {
  return (
    <DropdownMenu>
      <ActionsMenuTrigger />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onView}>
          <Eye className="h-3.5 w-3.5 text-fg/50" />
          View Details
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
