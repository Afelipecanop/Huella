import { waitFor } from "@testing-library/react-native";
import { renderHookWithQueryClient } from "../../test-utils/renderWithQueryClient";
import { useCreateTransaction } from "../useCreateTransaction";
import * as transactionsApi from "../../api/transactions";
import type { Transaction } from "@huella/shared-types";

jest.mock("../../api/transactions");

test("creates a transaction and resolves with the API response", async () => {
  const created: Transaction = {
    id: "tx1",
    user_id: "u1",
    account_id: "acc1",
    category_id: null,
    amount: -1500,
    currency: "ARS",
    merchant: null,
    date: "2026-08-20T00:00:00.000Z",
    source: "manual",
    status: "confirmed",
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
  };
  jest.spyOn(transactionsApi, "createTransaction").mockResolvedValue(created);

  const { result } = await renderHookWithQueryClient(() => useCreateTransaction());

  result.current.mutate({ account_id: "acc1", amount: -1500, date: "2026-08-20T00:00:00.000Z" });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual(created);
});
