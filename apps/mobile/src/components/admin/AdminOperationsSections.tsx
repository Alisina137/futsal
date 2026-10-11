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

export function ConfigurationSection({ settings, monthly, setMonthly, annual, setAnnual, configTrialHours, setConfigTrialHours, busy, action, token, t }: any) {
  if (!settings) return <Card style={styles.panel}><AppText muted>{t("phase7.admin.loadError")}</AppText></Card>;
  return <Card style={styles.panel}>
    <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.configuration")}</AppText>
    <AppText muted>Manage platform-wide commercial defaults.</AppText>
    <View style={styles.formGrid}>
      <TextField label={t("phase7.subscription.monthly")} value={monthly} onChangeText={setMonthly} keyboardType="number-pad" forceLtr containerStyle={styles.flexField}/>
      <TextField label={t("phase7.subscription.annual")} value={annual} onChangeText={setAnnual} keyboardType="number-pad" forceLtr containerStyle={styles.flexField}/>
      <TextField label={t("phase7.admin.trialHours")} value={configTrialHours} onChangeText={setConfigTrialHours} keyboardType="number-pad" forceLtr containerStyle={styles.flexField}/>
    </View>
    <View style={styles.alignStart}>
      <Button label={t("common.save")} onPress={() => void action(
        () => adminApi.updateSettings(token, {
          monthlyPriceAfn: Number(monthly),
          annualPriceAfn: Number(annual),
          trialDurationHours: Number(configTrialHours),
          featureFlags: settings.featureFlags ?? {},
          notificationTemplates: settings.notificationTemplates ?? {},
          reason:"Changed platform configuration after administrative review",
          expectedUpdatedAt:settings.updatedAt,
        }),
        t("phase7.admin.updated"),
      )} disabled={busy}/>
    </View>
  </Card>;
}

export function SupportSection({ targetType, setTargetType, targetId, setTargetId, note, setNote, busy, action, token, t }: any) {
  return <Card style={styles.panel}>
    <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.support")}</AppText>
    <AppText muted>Add an internal support note against a user or venue.</AppText>
    <View style={styles.rowActions}>
      <Button label={targetType === "VENUE" ? t("phase7.admin.targetVenue") : t("phase7.admin.targetUser")} onPress={() => setTargetType((value: "USER" | "VENUE") => value === "VENUE" ? "USER" : "VENUE")} variant="secondary"/>
    </View>
    <TextField label={t("phase7.admin.targetId")} value={targetId} onChangeText={setTargetId} forceLtr/>
    <TextField label={t("phase7.admin.note")} value={note} onChangeText={setNote} multiline/>
    <View style={styles.alignStart}>
      <Button label={t("phase7.admin.addNote")} onPress={() => void action(
        () => adminApi.supportNote(token, targetType, targetId, note),
        t("phase7.admin.updated"),
      )} disabled={busy || !targetId || note.trim().length < 3}/>
    </View>
  </Card>;
}

export function ModerationSection({ postId, setPostId, promotionId, setPromotionId, reason, setReason, busy, action, token, t }: any) {
  return <Card style={styles.panel}>
    <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.moderation")}</AppText>
    <AppText muted>Moderate published content and active promotions.</AppText>
    <TextField label={t("phase7.admin.reason")} value={reason} onChangeText={setReason}/>
    <View style={styles.formGrid}>
      <TextField label={t("phase7.admin.postId")} value={postId} onChangeText={setPostId} forceLtr containerStyle={styles.flexField}/>
      <Button label={t("phase7.admin.unpublishPost")} onPress={() => void action(
        () => adminApi.unpublishPost(token, postId, reason),
        t("phase7.admin.updated"),true,postId,
      )} disabled={busy || !postId || reason.trim().length < 3} variant="danger"/>
    </View>
    <View style={styles.formGrid}>
      <TextField label={t("phase7.admin.promotionId")} value={promotionId} onChangeText={setPromotionId} forceLtr containerStyle={styles.flexField}/>
      <Button label={t("phase7.admin.closePromotion")} onPress={() => void action(
        () => adminApi.closePromotion(token, promotionId, reason),
        t("phase7.admin.updated"),true,promotionId,
      )} disabled={busy || !promotionId || reason.trim().length < 3} variant="danger"/>
    </View>
  </Card>;
}

export function AuditSection({ audit, t }: { audit: AdminAuditLogDto[]; t: (key: any, params?: Record<string, string | number>) => string }) {
  return <Card style={styles.panel}>
    <View style={styles.tableHeader}>
      <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.audit")}</AppText>
      <View style={styles.countBadge}><AppText variant="caption" weight="bold">{audit.length}</AppText></View>
    </View>
    {audit.length === 0 ? <AppText muted>No audit entries found.</AppText> : audit.slice(0, 50).map((item) => <View key={item.id} style={styles.auditRow}>
      <View style={styles.auditDot}/>
      <View style={{ flex: 1 }}>
        <AppText weight="semibold">{item.action}</AppText>
        <AppText variant="caption" muted>{item.targetType} · {item.targetId ?? "-"}</AppText>
      </View>
    </View>)}
  </Card>;
}
