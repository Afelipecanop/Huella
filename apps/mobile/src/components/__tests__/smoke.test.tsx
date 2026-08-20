import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";

test("renders text", () => {
  render(<Text>Huella</Text>);
  expect(screen.getByText("Huella")).toBeTruthy();
});
