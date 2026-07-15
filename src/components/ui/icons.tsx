import { cn } from "@/utils/cn";

type IconProps = React.SVGProps<SVGSVGElement> & { className?: string };

export const Icons = {
  Logo: (props: IconProps) => (
    <svg viewBox="0 0 40 40" fill="none" {...props} className={cn("h-9 w-9", props.className)}>
      <path
        d="M20 3.5c7.2 0 13 5.8 13 13 0 9.2-7.8 17.5-13 20-5.2-2.5-13-10.8-13-20 0-7.2 5.8-13 13-13Z"
        className="fill-[hsl(var(--accent))]"
        opacity="0.95"
      />
      <path
        d="M12.2 15.7h15.6c.7 0 1.2.5 1.2 1.2v6.2c0 .7-.5 1.2-1.2 1.2H12.2c-.7 0-1.2-.5-1.2-1.2v-6.2c0-.7.5-1.2 1.2-1.2Z"
        className="fill-white/90"
      />
      <path
        d="M14.5 22.4v-4.4M25.5 22.4v-4.4"
        stroke="rgba(15,23,42,.35)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  ),
  Search: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="m21 21-4.3-4.3m1.8-5.2a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Plus: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  ChevronDown: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  ChevronLeft: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="m15 18-6-6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  ChevronRight: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="m9 18 6-6-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Sun: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  Moon: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M21 13.4A8 8 0 0 1 10.6 3a6.5 6.5 0 1 0 10.4 10.4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Bars: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-5 w-5", props.className)}>
      <path
        d="M4 6h16M4 12h16M4 18h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  X: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-5 w-5", props.className)}>
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  ArrowRight: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M5 12h14M13 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
  ,
  Home: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M4 11.5 12 4l8 7.5V20a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 20v-8.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9.5 21.5v-7h5v7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  Box: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M21 8.5 12 3 3 8.5V20l9 5 9-5V8.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M3 8.5l9 5 9-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 13.5V25" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  Cart: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M6 6h15l-2 9H7L6 6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M6 6 5 3H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" />
      <path d="M17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" />
    </svg>
  ),
  Tag: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M20 13 13 20 3 10V3h7l10 10Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M7.5 7.5h.01" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  ),
  Chart: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path d="M4 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 19h17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 15l4-4 3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  Users: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M16 20v-1.2c0-1.6-1.6-2.8-4-2.8s-4 1.2-4 2.8V20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 12a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 12 12Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M20 20v-1c0-1.2-1-2.2-2.6-2.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M17.8 6.2a3 3 0 0 1 0 5.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  File: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M14 2v5h5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 13h8M8 17h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Settings: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M19.4 15a8 8 0 0 0 .1-1l2-1.3-2-3.4-2.3.6a8.7 8.7 0 0 0-1.7-1L15.2 6h-4.4L10.5 8a8.7 8.7 0 0 0-1.7 1l-2.3-.6-2 3.4 2 1.3a8 8 0 0 0 0 2l-2 1.3 2 3.4 2.3-.6c.5.4 1.1.7 1.7 1l.3 2h4.4l.3-2c.6-.3 1.2-.6 1.7-1l2.3.6 2-3.4-2-1.3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  ),
  Trash: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Image: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M4 16l4.5-4.5a2 2 0 0 1 2.8 0L16 16M14 8h.02M5 20h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Upload: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M12 15V3m0 0 4 4m-4-4L8 7M5 19h14a2 2 0 0 0 2-2v-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Sync: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M4 12a8 8 0 0 1 8-8V2l3 3-3 3V6a6 6 0 0 0-6 6M20 12a8 8 0 0 1-8 8v-3l-3 3 3 3v-3a6 6 0 0 0 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Truck: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M1 3h13v13H1zM14 8h4l3 3v5h-7V8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  Package: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M21 8.5 12 3 3 8.5V15.5L12 21l9-5.5V8.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M3 8.5l9 5.5 9-5.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 14v7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7.5 6 12 8.5 16.5 6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  Layers: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  Building: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M3 21h18M4 21V7l8-4 8 4v14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9 21v-4h6v4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <rect x="9" y="9" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.6" />
      <rect x="13" y="9" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.6" />
      <rect x="9" y="13" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.6" />
      <rect x="13" y="13" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.6" />
    </svg>
  ),
  ExternalLink: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15 3h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 14 21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Check: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Warning: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Info: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Filter: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path
        d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  ),
  CreditCard: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  Grid: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  List: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props} className={cn("h-4 w-4", props.className)}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

