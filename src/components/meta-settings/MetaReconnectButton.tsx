import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { getMetaConnectUrl } from "@/lib/api/meta";

interface MetaReconnectButtonProps {
  variant?: "primary" | "outline";
}

// Restarts Meta sign-in, so a failed catalog step is never a dead end.
export function MetaReconnectButton({ variant = "primary" }: MetaReconnectButtonProps) {
  const mutation = useMutation({
    mutationFn: async () => (await getMetaConnectUrl()).data.url,
    onSuccess: (url) => {
      window.location.href = url;
    },
  });
  return (
    <div className="flex flex-col gap-1.5">
      <div>
        <Button type="button" variant={variant} onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Redirecting…" : "Reconnect Meta"}
        </Button>
      </div>
      {mutation.isError && <p className="text-xs font-medium text-danger">{(mutation.error as Error).message}</p>}
    </div>
  );
}
