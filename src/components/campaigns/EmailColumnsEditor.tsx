import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/ActionsMenu";
import { BLOCK_LABEL, BLOCK_PALETTE, DESIGN_LIMITS, LEAF_BLOCK_TYPES } from "@/config/emailBuilder";
import { createLeafBlock, moveItem } from "@/lib/campaigns/emailDesign";
import type { ColumnsProps, LeafBlock } from "@/types/campaign";

interface EmailColumnsEditorProps {
  props: ColumnsProps;
  onChange: (props: ColumnsProps) => void;
  onSelectChild: (id: string) => void;
}

const LEAF_PALETTE = BLOCK_PALETTE.filter((p) => (LEAF_BLOCK_TYPES as string[]).includes(p.type));

function childSummary(block: LeafBlock) {
  if (block.type === "heading") return block.props.text;
  if (block.type === "button") return block.props.label;
  if (block.type === "text") return block.props.html.replace(/<[^>]+>/g, " ").trim();
  return "";
}

export function EmailColumnsEditor({ props, onChange, onSelectChild }: EmailColumnsEditorProps) {
  const setColumn = (index: number, blocks: LeafBlock[]) => {
    const columns = props.columns.map((c, i) => (i === index ? { blocks } : c)) as ColumnsProps["columns"];
    onChange({ ...props, columns });
  };

  return (
    <div className="space-y-3">
      {props.columns.map((col, ci) => (
        <div key={ci} className="space-y-1.5 rounded-lg border border-border p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-fg">Column {ci + 1}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2" disabled={col.blocks.length >= DESIGN_LIMITS.maxColumnBlocks}>
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {LEAF_PALETTE.map((item) => (
                  <DropdownMenuItem key={item.type} onSelect={() => setColumn(ci, [...col.blocks, createLeafBlock(item.type as LeafBlock["type"])])}>
                    <item.icon className="h-3.5 w-3.5 text-fg/50" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {col.blocks.length ? (
            <ul className="space-y-1">
              {col.blocks.map((child, i) => (
                <li key={child.id} className="flex items-center gap-1 rounded-md bg-bg-2 px-2 py-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto min-w-0 flex-1 justify-start truncate px-0 py-0 text-left text-xs font-normal hover:bg-transparent hover:text-accent"
                    onClick={() => onSelectChild(child.id)}
                  >
                    <span className="font-medium">{BLOCK_LABEL[child.type]}</span>
                    <span className="truncate text-fg/50">{childSummary(child)}</span>
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Move up" disabled={i === 0} onClick={() => setColumn(ci, moveItem(col.blocks, i, i - 1))}>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label="Move down"
                    disabled={i === col.blocks.length - 1}
                    onClick={() => setColumn(ci, moveItem(col.blocks, i, i + 1))}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Delete" onClick={() => setColumn(ci, col.blocks.filter((b) => b.id !== child.id))}>
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-2xs text-fg/50">Empty. Add a heading, text, image or button.</p>
          )}
        </div>
      ))}
      <p className="text-2xs text-fg/50">Click a block (here or on the email) to edit it. Columns stack on phones.</p>
    </div>
  );
}
