import { EmailPaletteTile } from "@/components/campaigns/EmailPaletteTile";
import { BLOCK_PALETTE } from "@/config/emailBuilder";
import type { BlockType } from "@/types/campaign";

interface EmailBuilderPaletteProps {
  disabled: boolean;
  onAdd: (type: BlockType) => void;
}

export function EmailBuilderPalette({ disabled, onAdd }: EmailBuilderPaletteProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-fg/55">Drag a block onto the email, or click to add it at the end.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-1">
        {BLOCK_PALETTE.map((item) => (
          <EmailPaletteTile key={item.type} item={item} disabled={disabled} onAdd={onAdd} />
        ))}
      </div>
    </div>
  );
}
