import { colors } from "../colors";

const requiredKeys = [
  "background",
  "surface",
  "foreground",
  "mutedForeground",
  "border",
  "primary",
  "destructive",
] as const;

test("light and dark palettes define the same set of tokens", () => {
  for (const key of requiredKeys) {
    expect(colors.light[key]).toBeTruthy();
    expect(colors.dark[key]).toBeTruthy();
  }
});

test("light and dark use different values (no accidental copy-paste)", () => {
  for (const key of requiredKeys) {
    expect(colors.light[key]).not.toBe(colors.dark[key]);
  }
});
