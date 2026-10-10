// Meta's infinity mark, drawn as a stroke in Meta's brand blue.
export function MetaLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 32" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <title>Meta</title>
      <path
        d="M6 22c0-7 4-14 8.5-14 5 0 8.5 7 10.5 10.5S30 26 33.5 26 42 22.5 42 16.5 39 6 34 6c-4.5 0-7.5 5-9 7.5S17 26 13 26c-4 0-7-1.5-7-4z"
        fill="none"
        stroke="#0866ff"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
