import { apiRequest } from "./client";
import type { Account } from "@huella/shared-types";

export function listAccounts() {
  return apiRequest<Account[]>("/accounts");
}
