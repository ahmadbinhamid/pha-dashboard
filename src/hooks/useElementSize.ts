import { useEffect, useState, type RefObject } from "react";

/** Live pixel size of an element (0 until mounted), via ResizeObserver. */
export function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.borderBoxSize?.[0];
      setSize({ width: box?.inlineSize ?? el.offsetWidth, height: box?.blockSize ?? el.offsetHeight });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
