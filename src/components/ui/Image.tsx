import { cn } from "@/utils/cn";

type BaseProps = {
  src: string;
  alt: string;
  className?: string;
  /** true → loading="eager", false/omitted → loading="lazy" */
  priority?: boolean;
  objectFit?: "cover" | "contain" | "fill" | "none";
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
  const { src, alt, className, priority, objectFit } = props;
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
      // only apply objectFit class when explicitly requested; let className handle layout otherwise
      className={cn(props.objectFit && fitClass, className)}
    />
  );
}
