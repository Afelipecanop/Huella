export const colors = {
  light: {
    background: "#F8FAFC",
    surface: "#FFFFFF",
    foreground: "#0F172A",
    mutedForeground: "#64748B",
    border: "#E1F2ED",
    primary: "#059669",
    destructive: "#DC2626",
  },
  dark: {
    background: "#0F172A",
    surface: "#1E293B",
    foreground: "#F8FAFC",
    mutedForeground: "#94A3B8",
    border: "rgba(255,255,255,0.08)",
    primary: "#10B981",
    destructive: "#F87171",
  },
} as const;

export type ThemeColors = typeof colors.light;
