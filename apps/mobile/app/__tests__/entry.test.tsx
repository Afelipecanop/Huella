import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQueryClient } from "../../src/test-utils/renderWithQueryClient";
import EntryScreen from "../entry";
import * as accountsApi from "../../src/api/accounts";
import * as transactionsApi from "../../src/api/transactions";

jest.mock("../../src/api/accounts");
jest.mock("../../src/api/transactions");
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn() }) }));

const account = {
  id: "acc1",
  user_id: "u1",
  name: "Efectivo",
  type: "cash" as const,
  currency: "ARS",
  created_at: "2026-08-20T00:00:00.000Z",
  updated_at: "2026-08-20T00:00:00.000Z",
};

// renderWithQueryClient is async (wraps RNTL's async render()) — always await it.
test("Guardar is disabled until an amount and account are set", async () => {
  jest.spyOn(accountsApi, "listAccounts").mockResolvedValue([account]);
  await renderWithQueryClient(<EntryScreen />);

  await waitFor(() => expect(screen.getByText("Efectivo")).toBeTruthy());

  expect(screen.getByText("Guardar").parent?.props.accessibilityState?.disabled).toBe(true);

  fireEvent.changeText(screen.getByPlaceholderText("0.00"), "150");

  await waitFor(() =>
    expect(screen.getByText("Guardar").parent?.props.accessibilityState?.disabled).toBe(false),
  );
});

test("saving calls createTransaction with a negative amount in cents", async () => {
  jest.spyOn(accountsApi, "listAccounts").mockResolvedValue([account]);
  const createSpy = jest.spyOn(transactionsApi, "createTransaction").mockResolvedValue({
    id: "tx1",
    user_id: "u1",
    account_id: "acc1",
    category_id: null,
    amount: -15000,
    currency: "ARS",
    merchant: null,
    date: "2026-08-20T00:00:00.000Z",
    source: "manual",
    status: "confirmed",
    created_at: "2026-08-20T00:00:00.000Z",
    updated_at: "2026-08-20T00:00:00.000Z",
  });

  await renderWithQueryClient(<EntryScreen />);
  await waitFor(() => expect(screen.getByText("Efectivo")).toBeTruthy());

  fireEvent.changeText(screen.getByPlaceholderText("0.00"), "150");

  // The amount-driven enable/disable recompute doesn't land in the same
  // synchronous tick as fireEvent.changeText in this RN/RNTL setup (see the
  // first test above, which also has to await this before it can rely on
  // the button being enabled) — wait for it before pressing, or the press
  // lands on a still-disabled button and is a no-op.
  await waitFor(() =>
    expect(screen.getByText("Guardar").parent?.props.accessibilityState?.disabled).toBe(false),
  );
  fireEvent.press(screen.getByText("Guardar"));

  // This project's installed @tanstack/query-core (5.101.4) always invokes
  // mutationFn as mutationFn(variables, mutationFnContext) — a second
  // context argument ({ client, meta, mutationKey }) is present on every
  // call, so toHaveBeenCalledWith(objectContaining(...)) (which matches the
  // full arguments list) never matches. Assert on the first argument
  // directly instead; this still verifies the real behavior the brief
  // cares about — createTransaction receives the right account_id and a
  // negative cents amount.
  await waitFor(() => expect(createSpy).toHaveBeenCalled());
  expect(createSpy.mock.calls[0]?.[0]).toEqual(
    expect.objectContaining({ account_id: "acc1", amount: -15000 }),
  );
});
