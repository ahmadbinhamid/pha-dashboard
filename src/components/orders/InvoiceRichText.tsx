import { richTextToBlocks } from "@/utils/richText";

// A policy field (Warranty & Returns, Legal Disclaimer) as it appears on the
// invoice: one line per block, bold and italic preserved, and list markers —
// a bullet, or the number the editor showed — printed as characters rather
// than carried by a <ul>/<ol>.
//
// Deliberately NOT dangerouslySetInnerHTML. Two reasons: the stored HTML would
// otherwise render with its own margins and heading sizes, which the 9.5px
// footer column can't take; and the PDF has to draw the same content from the
// same parsed blocks (see server/src/utils/pdf/invoicePdf.js#drawRichText), so
// rendering the raw markup here is how the two would drift apart.
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
