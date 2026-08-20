import { apiRequest } from "../client";
import {
  listTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "../transactions";

jest.mock("../client", () => ({ apiRequest: jest.fn() }));

const mockedApiRequest = apiRequest as jest.Mock;

beforeEach(() => {
  mockedApiRequest.mockReset();
});

test("listTransactions calls GET /transactions", async () => {
  mockedApiRequest.mockResolvedValue([]);
  await listTransactions();
  expect(mockedApiRequest).toHaveBeenCalledWith("/transactions");
});

test("getTransaction calls GET /transactions/:id", async () => {
  mockedApiRequest.mockResolvedValue({});
  await getTransaction("tx1");
  expect(mockedApiRequest).toHaveBeenCalledWith("/transactions/tx1");
});

test("createTransaction posts the manual entry payload", async () => {
  mockedApiRequest.mockResolvedValue({});
  const payload = { account_id: "acc1", amount: -1500, date: "2026-08-20T00:00:00.000Z" };
  await createTransaction(payload);
  expect(mockedApiRequest).toHaveBeenCalledWith("/transactions", { method: "POST", body: payload });
});

test("updateTransaction patches the given id", async () => {
  mockedApiRequest.mockResolvedValue({});
  const payload = { merchant: "Kiosco" };
  await updateTransaction("tx1", payload);
  expect(mockedApiRequest).toHaveBeenCalledWith("/transactions/tx1", { method: "PATCH", body: payload });
});

test("deleteTransaction deletes the given id", async () => {
  mockedApiRequest.mockResolvedValue(undefined);
  await deleteTransaction("tx1");
  expect(mockedApiRequest).toHaveBeenCalledWith("/transactions/tx1", { method: "DELETE" });
});
