// NOTE: These values are duplicated from `./src/theme/colors.ts` (kept in
// sync manually). Tailwind loads this config with Node's plain CommonJS
// `require()`, which cannot resolve a `.ts` source file without a build step
// (jiti/ts-node) — and the repo only guarantees Node >=20, so we can't rely
// on newer Node versions' native TypeScript stripping either. Inlining the
// primitives here avoids that resolution problem. If you change a color in
// `colors.ts`, update it here too.
const lightColors = {
  background: "#F8FAFC",
  surface: "#FFFFFF",
  foreground: "#0F172A",
  mutedForeground: "#64748B",
  border: "#E1F2ED",
  primary: "#059669",
  destructive: "#DC2626",
};

const darkColors = {
  background: "#0F172A",
  surface: "#1E293B",
  foreground: "#F8FAFC",
  mutedForeground: "#94A3B8",
  border: "rgba(255,255,255,0.08)",
  primary: "#10B981",
  destructive: "#F87171",
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        background: lightColors.background,
        surface: lightColors.surface,
        foreground: lightColors.foreground,
        "muted-foreground": lightColors.mutedForeground,
        border: lightColors.border,
        primary: lightColors.primary,
        destructive: lightColors.destructive,
        "dark-background": darkColors.background,
        "dark-surface": darkColors.surface,
        "dark-foreground": darkColors.foreground,
        "dark-muted-foreground": darkColors.mutedForeground,
        "dark-border": darkColors.border,
        "dark-primary": darkColors.primary,
        "dark-destructive": darkColors.destructive,
      },
    },
  },
  plugins: [],
};
