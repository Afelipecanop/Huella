import { colors } from "../colors";

// tailwind.config.js can't require() a .ts file from plain CJS, so it
// carries its own literal copy of these values — this test is the guard
// against that copy silently drifting from colors.ts.
const tailwindConfig = require("../../../tailwind.config.js");

test("tailwind.config.js color literals match src/theme/colors.ts exactly", () => {
  const theme = tailwindConfig.theme.extend.colors;

  expect(theme.background).toBe(colors.light.background);
  expect(theme.surface).toBe(colors.light.surface);
  expect(theme.foreground).toBe(colors.light.foreground);
  expect(theme["muted-foreground"]).toBe(colors.light.mutedForeground);
  expect(theme.border).toBe(colors.light.border);
  expect(theme.primary).toBe(colors.light.primary);
  expect(theme.destructive).toBe(colors.light.destructive);

  expect(theme["dark-background"]).toBe(colors.dark.background);
  expect(theme["dark-surface"]).toBe(colors.dark.surface);
  expect(theme["dark-foreground"]).toBe(colors.dark.foreground);
  expect(theme["dark-muted-foreground"]).toBe(colors.dark.mutedForeground);
  expect(theme["dark-border"]).toBe(colors.dark.border);
  expect(theme["dark-primary"]).toBe(colors.dark.primary);
  expect(theme["dark-destructive"]).toBe(colors.dark.destructive);
});
