import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { AdminDashboardResponse, AdminUserDto, AdminVenueDto, AdminRoleSubscriptionDto, SubscriptionPaymentDto, PlatformSettingsDto, AdminAuditLogDto } from "@leaguekick/contracts";
import { Pressable, View } from "react-native";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/TextField";
import { adminApi } from "../../lib/api";
import { styles } from "./AdminStyles";

function SearchPanel({ query, setQuery, reason, setReason, loading, reload, t }: {
  query: string; setQuery: (value: string) => void; reason: string; setReason: (value: string) => void; loading: boolean; reload: () => Promise<void>; t: (key: any, params?: Record<string, string | number>) => string;
}) {
  return <Card style={styles.panel}>
    <View style={styles.formGrid}>
      <TextField label={t("phase7.admin.searchHint")} value={query} onChangeText={setQuery} containerStyle={styles.flexField}/>
      <TextField label={t("phase7.admin.reason")} value={reason} onChangeText={setReason} containerStyle={styles.flexField}/>
      <Button label={t("phase7.admin.search")} onPress={() => void reload()} loading={loading}/>
    </View>
  </Card>;
}

export function UsersSection({ users, query, setQuery, reason, setReason, loading, busy, reload, action, token, t, isRTL }: any) {
  return <>
    <SearchPanel query={query} setQuery={setQuery} reason={reason} setReason={setReason} loading={loading} reload={reload} t={t}/>
    <Card style={styles.panel}>
      <View style={styles.tableHeader}>
        <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.users")}</AppText>
        <View style={styles.countBadge}><AppText variant="caption" weight="bold">{users.length}</AppText></View>
      </View>
      {users.length === 0 ? <AppText muted>No users found.</AppText> : users.map((user: AdminUserDto) => <View key={user.id} style={[styles.dataRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={styles.rowIdentity}>
          <View style={styles.avatar}><Ionicons name="person" size={18} color={colors.primary}/></View>
          <View style={{ flex: 1 }}>
            <AppText weight="semibold">{user.displayName}</AppText>
            <AppText variant="caption" muted forceLtr>{user.phone}</AppText>
          </View>
        </View>
        <View style={user.status === "SUSPENDED" ? styles.statusDanger : styles.statusSuccess}>
          <AppText variant="caption" weight="bold" style={{ color: user.status === "SUSPENDED" ? colors.danger : colors.success }}>{user.status}</AppText>
        </View>
        <Button label={user.status === "SUSPENDED" ? t("phase7.admin.restore") : t("phase7.admin.suspend")} onPress={() => void action(
          () => adminApi.setUserStatus(token, user.id, { status: user.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED", reason }),
          t("phase7.admin.updated"),
        )} disabled={busy || reason.trim().length < 3} variant={user.status === "SUSPENDED" ? "secondary" : "danger"}/>
      </View>)}
    </Card>
  </>;
}

export function VenuesSection({ venues, duplicates, query, setQuery, reason, setReason, loading, busy, reload, action, token, t, isRTL }: any) {
  return <>
    <SearchPanel query={query} setQuery={setQuery} reason={reason} setReason={setReason} loading={loading} reload={reload} t={t}/>
    <Card style={styles.panel}>
      <View style={styles.tableHeader}>
        <View>
          <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.venues")}</AppText>
          <AppText variant="caption" muted>{t("phase7.admin.duplicateCount", { count: duplicates.length })}</AppText>
        </View>
        <View style={styles.countBadge}><AppText variant="caption" weight="bold">{venues.length}</AppText></View>
      </View>
      {venues.map((venue: AdminVenueDto) => <View key={venue.id} style={styles.venueBlock}>
        <View style={[styles.dataRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={styles.rowIdentity}>
            <View style={styles.avatar}><Ionicons name="business" size={18} color={colors.primary}/></View>
            <View style={{ flex: 1 }}>
              <AppText weight="semibold">{venue.name}</AppText>
              <AppText variant="caption" muted>{venue.city} · {venue.status} · {venue.verificationStatus}</AppText>
              <AppText variant="caption" muted forceLtr>{venue.id}</AppText>
            </View>
          </View>
          <View style={styles.rowActions}>
            <Button label={t("phase7.admin.verify")} onPress={() => void action(() => adminApi.venueAction(token, venue.id, { action: "VERIFY", reason }), t("phase7.admin.updated"))} disabled={busy || reason.trim().length < 3} variant="secondary"/>
            <Button label={t("phase7.admin.reject")} onPress={() => void action(() => adminApi.venueAction(token, venue.id, { action: "REJECT", reason }), t("phase7.admin.updated"))} disabled={busy || reason.trim().length < 3} variant="secondary"/>
            <Button label={venue.status === "SUSPENDED" ? t("phase7.admin.restore") : t("phase7.admin.suspend")} onPress={() => void action(() => adminApi.venueAction(token, venue.id, { action: venue.status === "SUSPENDED" ? "RESTORE" : "SUSPEND", reason }), t("phase7.admin.updated"))} disabled={busy || reason.trim().length < 3} variant={venue.status === "SUSPENDED" ? "secondary" : "danger"}/>
          </View>
        </View>
      </View>)}
    </Card>

    {duplicates.length > 0 ? <Card style={styles.panel}>
      <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.duplicateReview")}</AppText>
      <AppText variant="caption" muted>{t("phase7.admin.duplicateReviewBody")}</AppText>
      {duplicates.map((group: AdminVenueDto[], groupIndex: number) => <View key={`duplicate-${groupIndex}`} style={styles.duplicateGroup}>
        <AppText weight="semibold">{t("phase7.admin.duplicateGroup", { number: groupIndex + 1, count: group.length })}</AppText>
        {group.map((venue) => <AppText key={venue.id} variant="caption">{venue.name} · {venue.city} · {venue.address}</AppText>)}
      </View>)}
    </Card> : null}
  </>;
}

