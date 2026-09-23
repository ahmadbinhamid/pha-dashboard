import { richTextToBlocks } from "@/utils/richText";

// A policy field on the invoice: one line per block, bold/italic preserved, list markers printed as characters instead of <ul>/<ol>.
// Not dangerouslySetInnerHTML: raw HTML would bring its own margins/heading sizes the footer column can't fit, and the PDF must draw from the same parsed blocks (server/src/utils/pdf/invoicePdf.js#drawRichText) to avoid drift.
export function InvoiceRichText({
  value,
  className,
  style,
  fallback = "—",
}: {
  value?: string | null;
  className?: string;
  /** The sheet's ink colours are plain hex constants, not theme classes. */
  style?: React.CSSProperties;
  fallback?: string;
}) {
  const blocks = richTextToBlocks(value);

  if (blocks.length === 0)
    return (
      <p className={className} style={style}>
        {fallback}
      </p>
    );

  return (
    <div className={className} style={style}>
      {blocks.map((block, blockIndex) => (
        <p key={blockIndex} className={blockIndex > 0 ? "mt-1" : undefined}>
          {block.marker ? `${block.marker} ` : null}
          {block.runs.map((run, runIndex) => {
            if (run.bold && run.italic) {
              return (
                <strong key={runIndex}>
                  <em>{run.text}</em>
                </strong>
              );
            }
            if (run.bold) return <strong key={runIndex}>{run.text}</strong>;
            if (run.italic) return <em key={runIndex}>{run.text}</em>;
            return <span key={runIndex}>{run.text}</span>;
          })}
        </p>
      ))}
    </div>
  );
}
