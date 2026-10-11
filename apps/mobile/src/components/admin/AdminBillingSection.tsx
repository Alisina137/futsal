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

export function SubscriptionsSection({ roleSubscriptions, venues, payments, paymentVenueId, setPayments, setPaymentVenueId, months, setMonths, amountAfn, setAmountAfn, paymentRef, setPaymentRef, trialHours, setTrialHours, reason, setReason, busy, action, token, t, isRTL }: any) {
  return <>
    <Card style={styles.panel}>
      <View style={styles.tableHeader}>
        <View style={{flex:1}}>
          <AppText variant="bodyLarge" weight="bold">{t("roles.paidRoleRequests")}</AppText>
          <AppText muted>{t("roles.paidRoleRequestsBody")}</AppText>
        </View>
        <View style={styles.countBadge}><AppText variant="caption" weight="bold">{roleSubscriptions.length}</AppText></View>
      </View>
      {roleSubscriptions.length===0?<AppText muted>{t("roles.noPaidRoleRequests")}</AppText>:roleSubscriptions.map((subscription:AdminRoleSubscriptionDto)=><View key={`${subscription.userId}:${subscription.role}`} style={[styles.dataRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={{flex:1,minWidth:240}}>
          <AppText weight="bold">{subscription.displayName}</AppText>
          {subscription.username?<AppText variant="caption" muted forceLtr>@{subscription.username}</AppText>:null}
          <AppText variant="caption" muted>{t(subscription.role==="VENUE_OWNER"?"roles.venueOwner":"roles.teamOwner")} · {subscription.monthlyPriceAfn} AFN/{t("roles.month")}</AppText>
          {subscription.paymentReference?<AppText variant="caption" muted forceLtr>{t("roles.paymentReference")}: {subscription.paymentReference}</AppText>:null}
        </View>
        <View style={subscription.status==="ACTIVE"?styles.statusSuccess:styles.statusDanger}>
          <AppText variant="caption" weight="bold" style={{color:subscription.status==="ACTIVE"?colors.success:colors.warning}}>{t(`roles.subscription.${subscription.status}` as never)}</AppText>
        </View>
        {subscription.status!=="ACTIVE"?<Button
          label={t("roles.confirmPaymentActivate")}
          onPress={()=>void action(
            ()=>adminApi.activateRoleSubscription(token,subscription.userId,subscription.role,{
              months:Number(months)||1,
              paymentReference:paymentRef.trim()||(subscription.status==="PENDING"?subscription.paymentReference?.trim():"")||"",
            }),
            t("phase7.admin.activated"),true,subscription.displayName+" · "+subscription.role,
          )}
          disabled={busy||!(paymentRef.trim()||(subscription.status==="PENDING"?subscription.paymentReference:""))||Number(months)<1||Number(months)>24||!Number.isInteger(Number(months))}
        />:null}
      </View>)}
    </Card>
    <Card style={styles.panel}>
      <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.payments")}</AppText>
      <TextField label={t("phase7.admin.reason")} value={reason} onChangeText={setReason}/>
      <AppText variant="caption" muted>Choose a venue below to activate a subscription, extend a trial, or inspect payment history.</AppText>
    </Card>

    {venues.map((venue: AdminVenueDto) => <Card key={venue.id} style={styles.panel}>
      <View style={[styles.tableHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={{ flex: 1 }}>
          <AppText weight="bold">{venue.name}</AppText>
          <AppText variant="caption" muted>{venue.city} · {venue.subscriptionState}</AppText>
        </View>
        <AppText variant="caption" muted forceLtr>{venue.id}</AppText>
      </View>
      <View style={styles.formGrid}>
        <TextField label={t("phase7.admin.months")} value={months} onChangeText={setMonths} keyboardType="number-pad" forceLtr containerStyle={styles.smallField}/>
        <TextField label={t("phase7.admin.amount")} value={amountAfn} onChangeText={setAmountAfn} keyboardType="number-pad" forceLtr containerStyle={styles.smallField}/>
        <TextField label={t("phase7.admin.paymentReference")} value={paymentRef} onChangeText={setPaymentRef} forceLtr containerStyle={styles.flexField}/>
      </View>
      <View style={styles.rowActions}>
        <Button label={t("phase7.admin.activate")} onPress={() => void action(
          () => adminApi.activateSubscription(token, venue.id, { months: Number(months), amountAfn: Number(amountAfn), provider: "MANUAL", providerReference: paymentRef, note: reason }),
          t("phase7.admin.activated"),
        )} disabled={busy || reason.trim().length < 3||paymentRef.trim().length<3||
          !Number.isInteger(Number(months))||Number(months)<1||Number(months)>24||
          !Number.isInteger(Number(amountAfn))||Number(amountAfn)<1}/>
        <TextField label={t("phase7.admin.trialHours")} value={trialHours} onChangeText={setTrialHours} keyboardType="number-pad" forceLtr containerStyle={styles.smallField}/>
        <Button label={t("phase7.admin.extendTrial")} onPress={() => void action(
          () => adminApi.extendTrial(token, venue.id, { hours: Number(trialHours), reason }),
          t("phase7.admin.updated"),
        )} disabled={busy || reason.trim().length < 3} variant="secondary"/>
        <Button label={t("phase7.admin.paymentHistory")} onPress={() => void action(async () => {
          const result = await adminApi.payments(token, venue.id);
          setPaymentVenueId(venue.id);
          setPayments(result.payments);
        }, t("phase7.admin.paymentsLoaded"), false)} variant="secondary"/>
      </View>
    </Card>)}

    {paymentVenueId ? <Card style={styles.panel}>
      <AppText variant="bodyLarge" weight="bold">{t("phase7.admin.paymentHistory")}</AppText>
      <AppText variant="caption" muted forceLtr>{paymentVenueId}</AppText>
      {payments.length === 0 ? <AppText muted>{t("phase7.subscription.noPayments")}</AppText> : payments.map((payment: SubscriptionPaymentDto) => <View key={payment.id} style={styles.dataRow}>
        <View style={{ flex: 1 }}>
          <AppText weight="semibold" forceLtr>{payment.amountAfn} AFN · {payment.provider}</AppText>
          <AppText variant="caption" muted>{t(`phase7.payment.${payment.status}` as never)}</AppText>
        </View>
        {payment.status === "RECORDED" ? <Button label={t("phase7.admin.voidPayment")} onPress={() => void action(
          () => adminApi.voidPayment(token, payment.id, reason),
          t("phase7.admin.updated"),true,payment.id+" · "+payment.amountAfn+" AFN",
        )} disabled={busy || reason.trim().length < 3} variant="danger"/> : null}
      </View>)}
    </Card> : null}
  </>;
}

