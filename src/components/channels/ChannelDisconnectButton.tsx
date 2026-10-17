import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface ChannelDisconnectButtonProps {
  name: string;
  disconnect: () => Promise<unknown>;
  warning?: string;
  invalidateQueryKeys?: readonly (readonly string[])[];
}

export function ChannelDisconnectButton({ name, disconnect, warning, invalidateQueryKeys = [] }: ChannelDisconnectButtonProps) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: disconnect,
    onSuccess: () => {
      setConfirming(false);
      for (const queryKey of [["channels"], ...invalidateQueryKeys]) {
        void queryClient.invalidateQueries({ queryKey: [...queryKey] });
      }
    },
  });

  return (
    <>
      <Button variant="outline" onClick={() => setConfirming(true)}>
        Disconnect
      </Button>
      <ConfirmModal
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open);
          if (!open) mutation.reset();
        }}
        title={`Disconnect ${name}?`}
        description={
          <>
            {warning ?? `Syncing to ${name} stops and its stored access token is deleted.`}
            {mutation.isError && (
              <span className="mt-2 block font-medium text-danger">
                {(mutation.error as Error)?.message || `Failed to disconnect ${name}`}
              </span>
            )}
          </>
        }
        confirmLabel="Disconnect"
        tone="danger"
        confirming={mutation.isPending}
        onConfirm={() => mutation.mutate()}
      />
    </>
  );
}
