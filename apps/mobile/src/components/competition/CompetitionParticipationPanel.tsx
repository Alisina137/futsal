import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {CompetitionParticipationDto} from "@leaguekick/contracts";
import {Image,Pressable,StyleSheet,View} from "react-native";
import {resolveMediaImageUrl} from "../../lib/api";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";

type Props={
  participations:CompetitionParticipationDto[];
  onAccept?:(teamId:string)=>void;
  onDecline?:(teamId:string)=>void;
  onWithdraw?:(teamId:string)=>void;
  busy?:boolean;
  compact?:boolean;
  /** Publicly available logos only; pending or private teams use a shield fallback. */
  teamLogos?:Record<string,string|null>;
};
type Presentation={icon:keyof typeof Ionicons.glyphMap;color:string;background:string};
const registrationAppearance:Record<CompetitionParticipationDto["status"],Presentation>={
  INVITED:{icon:"mail-outline",color:"#93610B",background:"#FFF4D6"},
  APPLIED:{icon:"paper-plane-outline",color:colors.primary,background:colors.primarySoft},
  PENDING:{icon:"time-outline",color:"#93610B",background:"#FFF4D6"},
  ACCEPTED:{icon:"checkmark-circle-outline",color:colors.success,background:"#E5F5E9"},
  REJECTED:{icon:"close-circle-outline",color:colors.danger,background:"#FCE7E7"},
  WITHDRAWN:{icon:"remove-circle-outline",color:colors.textMuted,background:colors.surfaceMuted},
};
const paymentAppearance:Record<CompetitionParticipationDto["feeStatus"],Presentation>={
  UNPAID:{icon:"alert-circle-outline",color:"#93610B",background:"#FFF4D6"},
  PENDING:{icon:"time-outline",color:"#93610B",background:"#FFF4D6"},
  PAID:{icon:"checkmark-circle-outline",color:colors.success,background:"#E5F5E9"},
  WAIVED:{icon:"checkmark-circle-outline",color:colors.success,background:"#E5F5E9"},
};
export function CompetitionParticipationPanel({
  participations,onAccept,onDecline,onWithdraw,busy=false,compact=false,teamLogos={},
}:Props){
  const {t,isRTL}=useLocale();
  if(participations.length===0)return null;
  return <View testID="competition-my-participations" style={styles.wrapper}>
    {!compact?<View style={styles.summary}>
      <View style={[styles.summaryTitle,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.summaryIcon}>
          <Ionicons name="clipboard-outline" size={21} color={colors.primary}/>
        </View>
        <AppText weight="bold" variant="bodyLarge" style={{flex:1,minWidth:0}}>
          {t("competition.detail.sub.MY_PARTICIPATION")}
        </AppText>
        <View style={styles.countPill}>
          <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
            {t("competition.detail.participationsCount",{count:participations.length})}
          </AppText>
        </View>
      </View>
      <AppText variant="caption" muted>{t("competition.detail.myParticipationExplainer")}</AppText>
    </View>:null}
    {participations.map(item=>{
      const registration=registrationAppearance[item.status];
      const payment=paymentAppearance[item.feeStatus];
      const logo=resolveMediaImageUrl(teamLogos[item.teamId]??null);
      // An unaccepted invitation has no payment obligation yet. Never imply
      // an unpaid invite/rejected/withdrawn team owes a confirmed fee.
      const showPayment=(item.status==="APPLIED"||item.status==="PENDING"||
        item.status==="ACCEPTED"||item.feeStatus!=="UNPAID");
      return <View key={item.teamId} testID={`competition-participation-${item.teamId}`}
        style={styles.card}>
        <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.logo}>
            {logo?<Image source={{uri:logo}} style={styles.logoImage} resizeMode="cover"/>:
              <Ionicons name="shield-outline" size={24} color={colors.primary}/>}
          </View>
          <View style={styles.text}>
            <AppText variant="bodyLarge" weight="bold" numberOfLines={2}>
              {item.teamName.trim()||t("competition.phase3.yourTeam")}
            </AppText>
            <AppText variant="caption" muted>
              {item.isManager?t("competition.phase3.teamManager"):t("competition.phase3.teamMember")}
            </AppText>
          </View>
        </View>
        <View style={[styles.stateRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <AppText variant="caption" muted style={{flex:1}}>
            {t("competition.detail.registrationStateLabel")}
          </AppText>
          <View style={[styles.badge,{backgroundColor:registration.background,
            flexDirection:isRTL?"row-reverse":"row"}]}>
            <Ionicons name={registration.icon} size={16} color={registration.color}/>
            <AppText variant="caption" weight="semibold" style={{color:registration.color}}>
              {t(`competition.registrationStatus.${item.status}` as never)}
            </AppText>
          </View>
        </View>
        <View style={[styles.hint,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="information-circle-outline" size={19} color={colors.primary}/>
          <AppText variant="caption" style={{flex:1,color:colors.text}}
            testID={`competition-participation-hint-${item.teamId}`}>
            {t(`competition.detail.participationHint.${item.status}` as never)}
          </AppText>
        </View>
        {showPayment?<View style={[styles.paymentRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={[styles.paymentLabel,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Ionicons name="wallet-outline" size={17} color={colors.textMuted}/>
            <AppText variant="caption" muted style={{flex:1}}>
              {t("competition.phase3.feeStatus")}
            </AppText>
          </View>
          <View style={[styles.badge,{backgroundColor:payment.background,
            flexDirection:isRTL?"row-reverse":"row"}]}>
            <Ionicons name={payment.icon} size={15} color={payment.color}/>
            <AppText variant="caption" weight="semibold" style={{color:payment.color}}>
              {t(`competition.feeStatus.${item.feeStatus}` as never)}
            </AppText>
          </View>
        </View>:null}
        {item.status==="INVITED"&&item.isManager&&item.canRespond?
          <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Pressable disabled={busy} accessibilityRole="button"
              testID={`competition-accept-${item.teamId}`}
              onPress={()=>onAccept?.(item.teamId)}
              style={[styles.button,styles.primary,busy&&styles.disabled]}>
              <AppText style={styles.primaryText} weight="semibold" variant="caption">
                {t("competition.phase3.accept")}
              </AppText>
            </Pressable>
            <Pressable disabled={busy} accessibilityRole="button"
              testID={`competition-decline-${item.teamId}`}
              onPress={()=>onDecline?.(item.teamId)}
              style={[styles.button,styles.secondary,busy&&styles.disabled]}>
              <AppText style={styles.secondaryText} weight="semibold" variant="caption">
                {t("competition.phase3.decline")}
              </AppText>
            </Pressable>
          </View>:null}
        {item.isManager&&item.canWithdraw&&item.status!=="INVITED"?
          <Pressable disabled={busy} accessibilityRole="button"
            testID={`competition-withdraw-${item.teamId}`}
            onPress={()=>onWithdraw?.(item.teamId)}
            style={[styles.button,styles.secondary,busy&&styles.disabled]}>
            <AppText style={styles.secondaryText} weight="semibold" variant="caption">
              {t("competition.phase3.withdraw")}
            </AppText>
          </Pressable>:null}
      </View>;
    })}
  </View>;
}
const styles=StyleSheet.create({
  wrapper:{gap:spacing.md},
  summary:{gap:spacing.sm,padding:spacing.md,borderRadius:radius.lg,
    backgroundColor:colors.primarySoft,borderWidth:1,borderColor:colors.border},
  summaryTitle:{alignItems:"center",gap:spacing.sm},
  summaryIcon:{width:39,height:39,borderRadius:12,backgroundColor:colors.surface,
    alignItems:"center",justifyContent:"center"},
  countPill:{paddingHorizontal:spacing.sm,paddingVertical:5,borderRadius:radius.pill,
    backgroundColor:colors.surface,maxWidth:"42%"},
  card:{borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,
    borderRadius:radius.lg,padding:spacing.md,gap:spacing.sm,
    shadowColor:"#0F172A",shadowOpacity:.05,shadowOffset:{width:0,height:3},
    shadowRadius:10,elevation:1},
  heading:{alignItems:"center",gap:spacing.sm},
  logo:{width:48,height:48,borderRadius:14,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center",overflow:"hidden"},
  logoImage:{width:"100%",height:"100%"},
  text:{flex:1,minWidth:0,gap:4},
  stateRow:{gap:spacing.sm,alignItems:"center",justifyContent:"space-between"},
  badge:{gap:5,borderRadius:radius.pill,paddingVertical:6,paddingHorizontal:spacing.sm,
    alignItems:"center",justifyContent:"center",maxWidth:"62%"},
  hint:{gap:spacing.sm,backgroundColor:colors.primarySoft,padding:spacing.sm,
    borderRadius:radius.md,alignItems:"flex-start"},
  paymentRow:{borderTopWidth:1,borderTopColor:colors.border,paddingTop:spacing.sm,
    alignItems:"center",gap:spacing.sm,justifyContent:"space-between"},
  paymentLabel:{alignItems:"center",gap:spacing.xs,flex:1,minWidth:0},
  actions:{gap:spacing.sm},
  button:{minHeight:44,borderRadius:radius.md,borderWidth:1,paddingHorizontal:spacing.sm,
    alignItems:"center",justifyContent:"center",flexGrow:1,flexBasis:0},
  primary:{backgroundColor:colors.primary,borderColor:colors.primary},
  secondary:{backgroundColor:colors.surface,borderColor:colors.primary},
  primaryText:{color:"#FFFFFF",textAlign:"center"},
  secondaryText:{color:colors.primary,textAlign:"center"},
  disabled:{opacity:.5},
});
