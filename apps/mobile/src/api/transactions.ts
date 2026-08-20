import { apiRequest } from "./client";
import type { Transaction, CreateManualTransaction, UpdateTransaction } from "@huella/shared-types";

export function listTransactions() {
  return apiRequest<Transaction[]>("/transactions");
}

export function getTransaction(id: string) {
  return apiRequest<Transaction>(`/transactions/${id}`);
}

export function createTransaction(payload: CreateManualTransaction) {
  return apiRequest<Transaction>("/transactions", { method: "POST", body: payload });
}

export function updateTransaction(id: string, payload: UpdateTransaction) {
  return apiRequest<Transaction>(`/transactions/${id}`, { method: "PATCH", body: payload });
}

export function deleteTransaction(id: string) {
  return apiRequest<void>(`/transactions/${id}`, { method: "DELETE" });
}
