import { useQuery } from "@tanstack/react-query";
import { listTransactions } from "../api/transactions";

export function useTransactions() {
  return useQuery({ queryKey: ["transactions"], queryFn: listTransactions });
}
