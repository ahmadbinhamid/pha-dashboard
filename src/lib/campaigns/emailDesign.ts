import { DEFAULT_BLOCK_PROPS, DEFAULT_DESIGN_SETTINGS } from "@/config/emailBuilder";
import type { BlockType, DesignBlock, EmailDesign, LeafBlock, LeafBlockType } from "@/types/campaign";

export const newBlockId = () => Math.random().toString(36).slice(2, 10);

export function createBlock<T extends BlockType>(type: T): Extract<DesignBlock, { type: T }> {
  const props = structuredClone(DEFAULT_BLOCK_PROPS[type]);
  return { id: newBlockId(), type, props } as Extract<DesignBlock, { type: T }>;
}

export const createLeafBlock = (type: LeafBlockType) => createBlock(type) as LeafBlock;

/** Deep copy with fresh ids, so a duplicate never shares keys. */
export function cloneBlock<B extends DesignBlock>(block: B): B {
  const copy = structuredClone(block);
  copy.id = newBlockId();
  if (copy.type === "columns") {
    copy.props.columns.forEach((col) => col.blocks.forEach((b) => (b.id = newBlockId())));
  }
  return copy;
}

/** Re-ids every block, e.g. when a template is applied twice. */
export const cloneDesign = (design: EmailDesign): EmailDesign => ({
  settings: { ...DEFAULT_DESIGN_SETTINGS, ...design.settings },
  blocks: design.blocks.map(cloneBlock),
});

export const emptyDesign = (): EmailDesign => ({ settings: { ...DEFAULT_DESIGN_SETTINGS }, blocks: [] });

/** Fills settings a saved or API-made design left out, keeping its ids. */
export const normalizeDesign = (design: Partial<EmailDesign> | null | undefined): EmailDesign => ({
  settings: { ...DEFAULT_DESIGN_SETTINGS, ...design?.settings },
  blocks: design?.blocks ?? [],
});

/** Campaigns written before the builder become one text block. */
export function designFromHtml(html: string): EmailDesign {
  const design = emptyDesign();
  if (html.trim()) design.blocks.push({ ...createBlock("text"), props: { html, align: "left" } });
  return design;
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Finds a block at the top level or inside a column. */
export function findBlock(design: EmailDesign, id: string): DesignBlock | null {
  for (const block of design.blocks) {
    if (block.id === id) return block;
    if (block.type === "columns") {
      for (const col of block.props.columns) {
        const hit = col.blocks.find((b) => b.id === id);
        if (hit) return hit;
      }
    }
  }
  return null;
}

/** Returns a design with block `id` replaced, wherever it lives. */
export function replaceBlock(design: EmailDesign, id: string, next: DesignBlock): EmailDesign {
  const blocks = design.blocks.map((block) => {
    if (block.id === id) return next;
    if (block.type !== "columns") return block;
    const columns = block.props.columns.map((col) => ({
      blocks: col.blocks.map((b) => (b.id === id ? (next as LeafBlock) : b)),
    })) as typeof block.props.columns;
    return { ...block, props: { ...block.props, columns } };
  });
  return { ...design, blocks };
}

export function removeBlock(design: EmailDesign, id: string): EmailDesign {
  const blocks = design.blocks
    .filter((b) => b.id !== id)
    .map((block) => {
      if (block.type !== "columns") return block;
      const columns = block.props.columns.map((col) => ({ blocks: col.blocks.filter((b) => b.id !== id) }));
      return { ...block, props: { ...block.props, columns: columns as typeof block.props.columns } };
    });
  return { ...design, blocks };
}
