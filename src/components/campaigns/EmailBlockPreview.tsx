import type { CSSProperties, ReactNode } from "react";
import { ImageIcon, ShoppingBag } from "lucide-react";
import { useOrgSettings } from "@/context/orgSettings";
import { SOCIAL_NETWORK_OPTIONS } from "@/config/emailBuilder";
import type { DesignBlock, LeafBlock } from "@/types/campaign";

interface EmailBlockPreviewProps {
  block: DesignBlock;
  // Columns render their children through this, so each stays selectable.
  renderChild?: (child: LeafBlock) => ReactNode;
}

const HEADING_SIZES = { 1: 30, 2: 24, 3: 19 } as const;
const NETWORK_LABEL = Object.fromEntries(SOCIAL_NETWORK_OPTIONS.map((o) => [o.value, o.label]));

// Colours here are the user's own design choices, so they are inline styles.
function Placeholder({ icon: Icon, label }: { icon: typeof ImageIcon; label: string }) {
  return (
    <div className="flex h-28 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-bg-2 text-xs text-fg/50">
      <Icon className="h-5 w-5" />
      {label}
    </div>
  );
}

export function EmailBlockPreview({ block, renderChild }: EmailBlockPreviewProps) {
  const { settings: org } = useOrgSettings();
  const justify = (align: string) => ({ display: "flex", justifyContent: { left: "flex-start", center: "center", right: "flex-end" }[align] });

  switch (block.type) {
    case "heading": {
      const p = block.props;
      const style: CSSProperties = {
        fontSize: p.font_size || HEADING_SIZES[p.level],
        color: p.color || undefined,
        textAlign: p.align,
        fontWeight: 700,
        lineHeight: 1.25,
      };
      return <div style={style}>{p.text || "Heading"}</div>;
    }
    case "text": {
      const p = block.props;
      const style: CSSProperties = { fontSize: p.font_size || 15, color: p.color || undefined, textAlign: p.align, lineHeight: 1.6 };
      return <div className="[&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5" style={style} dangerouslySetInnerHTML={{ __html: p.html || "<p>Text</p>" }} />;
    }
    case "button": {
      const p = block.props;
      const style: CSSProperties = {
        background: p.bg_color,
        color: p.text_color,
        borderRadius: p.radius,
        padding: "13px 26px",
        fontWeight: 700,
        fontSize: 15,
        width: p.full_width ? "100%" : undefined,
        textAlign: "center",
      };
      return (
        <div style={justify(p.align)}>
          <span style={style}>{p.label || "Button"}</span>
        </div>
      );
    }
    case "image": {
      const p = block.props;
      if (!p.src) return <Placeholder icon={ImageIcon} label="Add an image in the settings panel" />;
      return (
        <div style={justify(p.align)}>
          <img src={p.src} alt={p.alt} style={{ width: `${p.width}%`, borderRadius: p.radius, display: "block" }} />
        </div>
      );
    }
    case "logo": {
      const p = block.props;
      return (
        <div style={justify(p.align)}>
          {org.logoUrl ? (
            <img src={org.logoUrl} alt={org.storeName} style={{ width: p.width, display: "block" }} />
          ) : (
            <span style={{ fontSize: 22, fontWeight: 700 }}>{org.storeName}</span>
          )}
        </div>
      );
    }
    case "divider":
      return <div style={{ borderTop: `${block.props.thickness}px solid ${block.props.color}` }} />;
    case "spacer":
      return <div style={{ height: block.props.height }} />;
    case "products": {
      const p = block.props;
      if (!p.items.length) return <Placeholder icon={ShoppingBag} label="Pick products in the settings panel" />;
      return (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${p.columns}, minmax(0, 1fr))`, gap: 16 }}>
          {p.items.map((item, i) => (
            <div key={`${item.title}-${i}`} style={{ fontSize: 14 }}>
              {item.image ? (
                <img src={item.image} alt={item.title} style={{ width: "100%", borderRadius: 6, display: "block" }} />
              ) : (
                <Placeholder icon={ShoppingBag} label="No photo" />
              )}
              <div style={{ marginTop: 8 }}>{item.title}</div>
              {p.show_price && item.price_label ? <div style={{ fontWeight: 700, margin: "4px 0 8px" }}>{item.price_label}</div> : null}
              {p.button_label ? <div style={{ color: p.accent_color, fontWeight: 700 }}>{p.button_label} →</div> : null}
            </div>
          ))}
        </div>
      );
    }
    case "social": {
      const p = block.props;
      return (
        <div style={{ textAlign: p.align, color: p.color || undefined, fontSize: 13, fontWeight: 700 }}>
          {p.links.map((l, i) => (
            <span key={`${l.network}-${i}`} style={{ margin: "0 8px", opacity: l.url ? 1 : 0.4 }}>
              {NETWORK_LABEL[l.network]}
            </span>
          ))}
        </div>
      );
    }
    case "columns":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: block.props.gap }}>
          {block.props.columns.map((col, i) => (
            <div key={i} className="min-h-16 rounded-md border border-dashed border-border/70 p-1">
              {col.blocks.length ? (
                col.blocks.map((child) => <div key={child.id}>{renderChild ? renderChild(child) : null}</div>)
              ) : (
                <div className="flex h-14 items-center justify-center text-xs text-fg/40">Column {i + 1}: add blocks</div>
              )}
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}
