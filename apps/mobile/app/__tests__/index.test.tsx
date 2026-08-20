import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQueryClient } from "../../src/test-utils/renderWithQueryClient";
import HomeScreen from "../index";
import * as transactionsApi from "../../src/api/transactions";

jest.mock("../../src/api/transactions");
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

// This project's jest config has no clearMocks/resetMocks, so the automocked
// listTransactions carries call history across tests in this file unless we
// reset it ourselves (same convention as src/api/__tests__/transactions.test.ts).
beforeEach(() => {
  (transactionsApi.listTransactions as jest.Mock).mockReset();
});

// renderWithQueryClient is async (wraps RNTL's async render()) — always await it.
test("shows the empty state when there are no transactions", async () => {
  jest.spyOn(transactionsApi, "listTransactions").mockResolvedValue([]);
  await renderWithQueryClient(<HomeScreen />);
  await waitFor(() => expect(screen.getByText(/Todavía no registraste gastos/)).toBeTruthy());
});

test("shows a row per transaction", async () => {
  jest.spyOn(transactionsApi, "listTransactions").mockResolvedValue([
    {
      id: "tx1",
      user_id: "u1",
      account_id: "acc1",
      category_id: null,
      amount: -1500,
      currency: "ARS",
      merchant: "Kiosco",
      date: "2026-08-20T00:00:00.000Z",
      source: "manual",
      status: "confirmed",
      created_at: "2026-08-20T00:00:00.000Z",
      updated_at: "2026-08-20T00:00:00.000Z",
    },
  ]);
  await renderWithQueryClient(<HomeScreen />);
  await waitFor(() => expect(screen.getByText("Kiosco")).toBeTruthy());
});

test("shows a retry button on error, which refetches", async () => {
  const listSpy = jest
    .spyOn(transactionsApi, "listTransactions")
    .mockRejectedValueOnce(new Error("network down"))
    .mockResolvedValueOnce([]);

  await renderWithQueryClient(<HomeScreen />);

  await waitFor(() => expect(screen.getByText("Reintentar")).toBeTruthy());
  fireEvent.press(screen.getByText("Reintentar"));

  await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2));
});
