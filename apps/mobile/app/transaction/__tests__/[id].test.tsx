import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQueryClient } from "../../../src/test-utils/renderWithQueryClient";
import TransactionDetailScreen from "../[id]";
import * as transactionsApi from "../../../src/api/transactions";
import * as categoriesApi from "../../../src/api/categories";

jest.mock("../../../src/api/transactions");
jest.mock("../../../src/api/categories");
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "tx1" }),
  useRouter: () => ({ back: jest.fn() }),
}));

const transaction = {
  id: "tx1",
  user_id: "u1",
  account_id: "acc1",
  category_id: null,
  amount: -1500,
  currency: "ARS",
  merchant: "Kiosco",
  date: "2026-08-20T00:00:00.000Z",
  source: "manual" as const,
  status: "confirmed" as const,
  created_at: "2026-08-20T00:00:00.000Z",
  updated_at: "2026-08-20T00:00:00.000Z",
};

beforeEach(() => {
  jest.spyOn(transactionsApi, "getTransaction").mockResolvedValue(transaction);
  jest.spyOn(categoriesApi, "listCategories").mockResolvedValue([]);
});

// renderWithQueryClient is async (wraps RNTL's async render()) — always await it.
test("shows a delete confirmation modal instead of deleting immediately", async () => {
  await renderWithQueryClient(<TransactionDetailScreen />);
  await waitFor(() => expect(screen.getByDisplayValue("Kiosco")).toBeTruthy());

  fireEvent.press(screen.getByText("Eliminar"));

  await waitFor(() => expect(screen.getByText("¿Eliminar esta transacción?")).toBeTruthy());
});

test("confirming delete calls deleteTransaction with the transaction id", async () => {
  const deleteSpy = jest.spyOn(transactionsApi, "deleteTransaction").mockResolvedValue(undefined);
  await renderWithQueryClient(<TransactionDetailScreen />);
  await waitFor(() => expect(screen.getByDisplayValue("Kiosco")).toBeTruthy());

  fireEvent.press(screen.getByText("Eliminar"));
  await waitFor(() => expect(screen.getByText("¿Eliminar esta transacción?")).toBeTruthy());
  fireEvent.press(screen.getAllByText("Eliminar")[1]);

  await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith("tx1"));
});
