import type Ionicons from "@expo/vector-icons/Ionicons";
export type SectionKey =
  | "dashboard"
  | "users"
  | "venues"
  | "manualTeams"
  | "subscriptions"
  | "configuration"
  | "support"
  | "moderation"
  | "audit";

type IconName = keyof typeof Ionicons.glyphMap;

export const adminNavItems: Array<{ key: SectionKey; icon: IconName; labelKey: string }> = [
  { key: "dashboard", icon: "grid-outline", labelKey: "phase7.admin.dashboard" },
  { key: "users", icon: "people-outline", labelKey: "phase7.admin.users" },
  { key: "venues", icon: "business-outline", labelKey: "phase7.admin.venues" },
  { key: "manualTeams", icon: "people-circle-outline", labelKey: "manualTeams.adminTitle" },
  { key: "subscriptions", icon: "card-outline", labelKey: "phase7.admin.payments" },
  { key: "configuration", icon: "options-outline", labelKey: "phase7.admin.configuration" },
  { key: "support", icon: "help-buoy-outline", labelKey: "phase7.admin.support" },
  { key: "moderation", icon: "shield-checkmark-outline", labelKey: "phase7.admin.moderation" },
  { key: "audit", icon: "document-text-outline", labelKey: "phase7.admin.audit" },
];

