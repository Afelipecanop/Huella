import { useQuery } from "@tanstack/react-query";
import { getTransaction } from "../api/transactions";

export function useTransaction(id: string) {
  return useQuery({ queryKey: ["transactions", id], queryFn: () => getTransaction(id) });
}
