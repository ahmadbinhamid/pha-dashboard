import { cn } from "@/utils/cn";

type BaseProps = {
  src: string;
  alt: string;
  className?: string;
  /** true → loading="eager", false/omitted → loading="lazy" */
  priority?: boolean;
  objectFit?: "cover" | "contain" | "fill" | "none";
  // For sizes chosen at runtime, e.g. a user's width in an email design.
  style?: React.CSSProperties;
};

type FillProps = BaseProps & {
  /** Fills nearest positioned ancestor — parent must be position:relative */
  fill: true;
  width?: never;
  height?: never;
};

type SizedProps = BaseProps & {
  fill?: false;
  /** Omit to let CSS control size (e.g. h-12 w-auto via className) */
  width?: number;
  height?: number;
};

export type ImageProps = FillProps | SizedProps;

export function Image(props: ImageProps) {
  const { src, alt, className, priority, objectFit, style } = props;
  const loading = priority ? "eager" : "lazy";

  const fitClass =
    objectFit === "contain" ? "object-contain"
    : objectFit === "fill" ? "object-fill"
    : objectFit === "none" ? "object-none"
    : "object-cover"; // default

  if (props.fill) {
    return (
      <img
        src={src}
        alt={alt}
        loading={loading}
        style={style}
        className={cn("absolute inset-0 h-full w-full", fitClass, className)}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={props.width}
      height={props.height}
      loading={loading}
      style={style}
      // objectFit only when asked for; otherwise className owns the layout.
      className={cn(props.objectFit && fitClass, className)}
    />
  );
}
