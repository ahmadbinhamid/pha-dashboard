export function SaveStatusText({ isSuccess, error }: { isSuccess: boolean; error: string | null }) {
  if (error) return <span className="text-xs font-medium text-danger">{error}</span>;
  if (isSuccess) return <span className="text-xs text-fg/55">Saved</span>;
  return null;
}
