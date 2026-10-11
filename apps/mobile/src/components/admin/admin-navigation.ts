import type Ionicons from "@expo/vector-icons/Ionicons";
export type SectionKey =
  | "dashboard"
  | "analytics"
  | "users"
  | "venues"
  | "manualTeams"
  | "teams"
  | "competitions"
  | "referees"
  | "reservations"
  | "cases"
  | "subscriptions"
  | "configuration"
  | "support"
  | "moderation"
  | "reports"
  | "announcements"
  | "deliveries"
  | "audit";

type IconName = keyof typeof Ionicons.glyphMap;

export const adminNavItems: Array<{ key: SectionKey; icon: IconName; labelKey: string }> = [
  { key: "dashboard", icon: "grid-outline", labelKey: "phase7.admin.dashboard" },
  { key: "analytics", icon: "analytics-outline", labelKey: "admin2.analyticsTitle" },
  { key: "users", icon: "people-outline", labelKey: "phase7.admin.users" },
  { key: "venues", icon: "business-outline", labelKey: "phase7.admin.venues" },
  { key: "manualTeams", icon: "people-circle-outline", labelKey: "manualTeams.adminTitle" },
  { key: "teams", icon: "shirt-outline", labelKey: "admin4.teams" },
  { key: "competitions", icon: "trophy-outline", labelKey: "admin4.competitions" },
  { key: "referees", icon: "flag-outline", labelKey: "admin4.referees" },
  { key: "reservations", icon: "calendar-outline", labelKey: "admin4.reservations" },
  { key: "cases", icon: "alert-circle-outline", labelKey: "admin4.cases" },
  { key: "subscriptions", icon: "card-outline", labelKey: "phase7.admin.payments" },
  { key: "configuration", icon: "options-outline", labelKey: "phase7.admin.configuration" },
  { key: "support", icon: "help-buoy-outline", labelKey: "phase7.admin.support" },
  { key: "moderation", icon: "shield-checkmark-outline", labelKey: "phase7.admin.moderation" },
  { key: "reports", icon: "flag-outline", labelKey: "admin6.reports" },
  { key: "announcements", icon: "megaphone-outline", labelKey: "admin6.announcements" },
  { key: "deliveries", icon: "send-outline", labelKey: "admin6.deliveries" },
  { key: "audit", icon: "document-text-outline", labelKey: "phase7.admin.audit" },
];

