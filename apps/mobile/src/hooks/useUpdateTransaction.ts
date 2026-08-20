import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTransaction } from "../api/transactions";
import type { UpdateTransaction } from "@huella/shared-types";

export function useUpdateTransaction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateTransaction) => updateTransaction(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
