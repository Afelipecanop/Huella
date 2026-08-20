import { render } from "@testing-library/react-native";
import { TransactionListSkeleton } from "../TransactionListSkeleton";

// render() is async in this @testing-library/react-native version — always await it.
test("renders 5 placeholder rows", async () => {
  const { toJSON } = await render(<TransactionListSkeleton />);
  expect(toJSON()).toBeTruthy();
});
