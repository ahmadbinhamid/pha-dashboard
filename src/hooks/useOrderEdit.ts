import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/context";
import { orderEditErrorMessage } from "@/lib/orders/orderEditErrors";
import type { BeResponse } from "@/lib/api/base";
import type { OrderDetail } from "@/types/orders";

// Runs an order edit and shows the server's refreshed order; never local maths.
export function useOrderEdit<TArgs>(
  orderId: string,
  edit: (args: TArgs) => Promise<BeResponse<OrderDetail>>,
  { successTitle, errorTitle, onSuccess }: { successTitle: string; errorTitle: string; onSuccess?: () => void },
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: edit,
    onSuccess: (res) => {
      queryClient.setQueryData(["order", orderId], res);
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: successTitle, tone: "success" });
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast({ title: errorTitle, description: orderEditErrorMessage(err), tone: "danger" });
    },
  });
}
