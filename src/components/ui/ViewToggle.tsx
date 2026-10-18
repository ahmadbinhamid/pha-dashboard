import { LayoutGrid, List } from "lucide-react";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/SegmentedControl";

export type ViewMode = "list" | "grid";

const OPTIONS: SegmentedOption<ViewMode>[] = [
  { value: "list", label: "List view", icon: List, iconOnly: true },
  { value: "grid", label: "Grid view", icon: LayoutGrid, iconOnly: true },
];

export function ViewToggle({
  value,
  onChange,
  className,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  className?: string;
}) {
  return <SegmentedControl options={OPTIONS} value={value} onChange={onChange} ariaLabel="Layout" className={className} />;
}
