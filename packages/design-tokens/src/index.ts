export const colors = {
  background: "#F5F7F6",
  surface: "#FFFFFF",
  surfaceMuted: "#ECF1EF",
  text: "#10231E",
  textMuted: "#5E716B",
  primary: "#087A5B",
  primaryPressed: "#056348",
  primarySoft: "#DDF3EB",
  accent: "#F2B705",
  border: "#D7E1DD",
  success: "#137A4A",
  warning: "#9A6200",
  danger: "#B42318",
  info: "#2457A7",
  overlay: "rgba(8, 26, 21, 0.48)",
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;
export const typography = {
  size: { caption: 12, body: 15, bodyLarge: 17, title: 24, display: 30 },
  lineHeight: { caption: 18, body: 23, bodyLarge: 26, title: 34, display: 40 },
  weight: { regular: "400", medium: "500", semibold: "600", bold: "700" },
} as const;
export const touchTarget = 48;
