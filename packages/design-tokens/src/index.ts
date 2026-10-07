export const colors = {
  background: "#F6F8FC",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF3FA",
  text: "#0F172A",
  textMuted: "#64748B",
  primary: "#2563EB",
  primaryPressed: "#1D4ED8",
  primarySoft: "#E8F0FF",
  accent: "#0EA5E9",
  border: "#D9E2F0",
  success: "#15803D",
  warning: "#A16207",
  danger: "#B42318",
  info: "#2563EB",
  overlay: "rgba(15, 23, 42, 0.46)",
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
export const typography = {
  size: { caption: 12, body: 15, bodyLarge: 17, title: 25, display: 32 },
  lineHeight: { caption: 18, body: 23, bodyLarge: 26, title: 34, display: 42 },
  weight: { regular: "400", medium: "500", semibold: "600", bold: "700" },
} as const;
export const touchTarget = 50;
