import { fireEvent, render, screen } from "@testing-library/react-native";
import { TransactionRow } from "../TransactionRow";
import type { Transaction } from "@huella/shared-types";

const transaction: Transaction = {
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
};

// render() is async in this @testing-library/react-native version — always await it.
test("shows the merchant name", async () => {
  await render(<TransactionRow transaction={transaction} onPress={jest.fn()} />);
  expect(screen.getByText("Kiosco")).toBeTruthy();
});

test("falls back to a placeholder when there is no merchant", async () => {
  await render(<TransactionRow transaction={{ ...transaction, merchant: null }} onPress={jest.fn()} />);
  expect(screen.getByText("Sin comercio")).toBeTruthy();
});

test("calls onPress with the transaction id when tapped", async () => {
  const onPress = jest.fn();
  await render(<TransactionRow transaction={transaction} onPress={onPress} />);
  fireEvent.press(screen.getByText("Kiosco"));
  expect(onPress).toHaveBeenCalledWith("tx1");
});
