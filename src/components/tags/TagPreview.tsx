import { useMemo, useRef } from "react";
import QRCode from "qrcode";
import { cn } from "@/utils/cn";
import { useElementSize } from "@/hooks/useElementSize";
import { tagSizeMm } from "@/config/productTag";
import { BAY_CHIP_PAD_MM, PT_TO_MM, layoutTag } from "@/lib/tags/tagPdf";
import type { TagContent, TagFont, TagStyle } from "@/types/tags";

// 380px wide for a 76 mm tag.
const PX_PER_MM = 5;
const mm = (v: number) => `${(v * PX_PER_MM).toFixed(2)}px`;
const pt = (v: number) => mm(v * PT_TO_MM);
// Same families the PDF prints with, so line breaks match.
const FONT_FAMILY: Record<TagFont, string> = {
  helvetica: "Helvetica, Arial, sans-serif",
  times: "'Times New Roman', Times, serif",
  courier: "'Courier New', Courier, monospace",
};
const GAP_MM = 2.5;
const BLOCK_GAP_MM = 0.8;

interface TagPreviewProps {
  content: TagContent;
  style: TagStyle;
  className?: string;
}

// NOTE: inline mm-based positions: they come from the PDF's own layout.
export function TagPreview({ content, style, className }: TagPreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const { width } = useElementSize(frameRef);
  const size = tagSizeMm(style);
  const tagWPx = size.width * PX_PER_MM;
  const tagHPx = size.height * PX_PER_MM;
  // Drawn at true size, then scaled down to fit narrow containers.
  const scale = width ? Math.min(1, width / tagWPx) : 1;
  const qr = useMemo(() => {
    const { modules } = QRCode.create(content.link, {
      errorCorrectionLevel: "M",
    });
    const cells: { x: number; y: number }[] = [];
    for (let y = 0; y < modules.size; y++)
      for (let x = 0; x < modules.size; x++)
        if (modules.get(y, x)) cells.push({ x, y });
    return { size: modules.size, cells };
  }, [content.link]);
  const layout = useMemo(() => layoutTag(content, style), [content, style]);
  const qrLeft = style.qr_position === "left";
  const textLeft = qrLeft
    ? layout.margin + layout.qrSize + GAP_MM
    : layout.margin;

  let top = layout.margin;
  const blocks = layout.body.map((b) => {
    const at = top;
    top += b.lines.length * b.pt * PT_TO_MM * layout.lineHeight + BLOCK_GAP_MM;
    return { ...b, top: at };
  });

  return (
    <div
      ref={frameRef}
      className={cn("max-w-full shrink-0", className)}
      style={{ width: tagWPx, height: tagHPx * scale }}
    >
      {/* Tags print black on white whatever the app theme is. */}
      <div
        className="relative origin-top-left overflow-hidden rounded-md border border-border bg-white text-black shadow-sm"
        style={{
          width: tagWPx,
          height: tagHPx,
          transform: `scale(${scale})`,
          fontFamily: FONT_FAMILY[style.font],
        }}
      >
        <svg
          viewBox={`0 0 ${qr.size} ${qr.size}`}
          className="absolute"
          style={{
            top: mm(layout.margin),
            [qrLeft ? "left" : "right"]: mm(layout.margin),
            width: mm(layout.qrSize),
            height: mm(layout.qrSize),
          }}
          shapeRendering="crispEdges"
          aria-label="QR code"
        >
          {qr.cells.map((c) => (
            <rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width={1} height={1} />
          ))}
        </svg>

        {blocks.map((b) => (
          <div
            key={b.key}
            className={cn(
              "absolute",
              b.bold && "font-bold",
              style.align === "center" && "text-center",
            )}
            style={{
              top: mm(b.top),
              left: mm(textLeft),
              width: mm(layout.textWidth),
              fontSize: pt(b.pt),
              lineHeight: layout.lineHeight,
            }}
          >
            {b.lines.map((line, i) => (
              <span key={i} className="block whitespace-nowrap">
                {line}
              </span>
            ))}
          </div>
        ))}

        {layout.footer && (
          <>
            <div
              className="absolute border-t border-black"
              style={{
                top: mm(layout.ruleY),
                left: mm(textLeft),
                width: mm(layout.textWidth),
              }}
            />
            <div
              className="absolute flex items-end justify-between leading-none"
              style={{
                left: mm(textLeft),
                width: mm(layout.textWidth),
                bottom: mm(
                  size.height - layout.footerBaseline - 0.4,
                ),
              }}
            >
              <span
                className={cn(
                  "whitespace-nowrap",
                  layout.footer.stock?.bold && "font-bold",
                )}
                style={{ fontSize: pt(layout.footer.stock?.pt ?? 0) }}
              >
                {layout.footer.stock?.lines[0]}
              </span>
              {layout.footer.bay && (
                <span
                  className={cn(
                    "whitespace-nowrap rounded-sm bg-black py-0.5 text-white",
                    layout.footer.bay.bold && "font-bold",
                  )}
                  style={{
                    fontSize: pt(layout.footer.bay.pt),
                    paddingInline: mm(BAY_CHIP_PAD_MM),
                  }}
                >
                  {layout.footer.bay.lines[0]}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
