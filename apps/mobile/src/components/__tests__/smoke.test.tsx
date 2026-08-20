import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";

test("renders text", async () => {
  await render(<Text>Huella</Text>);
  expect(screen.getByText("Huella")).toBeTruthy();
});
