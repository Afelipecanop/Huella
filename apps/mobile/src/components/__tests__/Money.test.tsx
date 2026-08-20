import { render, screen } from "@testing-library/react-native";
import { Money } from "../Money";

// render() is async in this @testing-library/react-native version — always await it.
test("renders a negative amount as a negative currency string", async () => {
  await render(<Money amountCents={-1500} currency="ARS" />);
  expect(screen.getByText(/-/)).toBeTruthy();
});

test("renders a positive amount without a minus sign", async () => {
  await render(<Money amountCents={1500} currency="ARS" />);
  expect(screen.queryByText(/^-/)).toBeNull();
});
