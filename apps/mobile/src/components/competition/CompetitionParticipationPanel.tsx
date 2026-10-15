import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {CompetitionParticipationDto} from "@leaguekick/contracts";
import {Pressable,StyleSheet,View} from "react-native";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";

type Props={
  participations:CompetitionParticipationDto[];
  onAccept?:(teamId:string)=>void;
  onDecline?:(teamId:string)=>void;
  onWithdraw?:(teamId:string)=>void;
  busy?:boolean;
  compact?:boolean;
};
const activeStatuses=new Set(["INVITED","APPLIED","PENDING","ACCEPTED"]);
export function CompetitionParticipationPanel({
  participations,onAccept,onDecline,onWithdraw,busy=false,compact=false,
}:Props){
  const {t,isRTL}=useLocale();
  if(participations.length===0)return null;
  return <View testID="competition-my-participations" style={styles.wrapper}>
    {!compact?<AppText weight="bold" variant="bodyLarge">
      {t("competition.phase3.myRegistrations")}
    </AppText>:null}
    {participations.map(item=><View key={item.teamId}
      testID={`competition-participation-${item.teamId}`}
      style={styles.card}>
      <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="shield-outline" size={19} color={colors.primary}/>
        <View style={styles.text}>
          <AppText weight="semibold" numberOfLines={2}>{item.teamName}</AppText>
          <AppText variant="caption" muted>{item.isManager?
            t("competition.phase3.teamManager"):t("competition.phase3.teamMember")}</AppText>
        </View>
        <View style={[styles.badge,activeStatuses.has(item.status)?styles.active:styles.inactive]}>
          <AppText variant="caption" weight="semibold" style={styles.badgeText}>
            {t(`competition.registrationStatus.${item.status}` as never)}
          </AppText>
        </View>
      </View>
      <AppText variant="caption" muted testID={`competition-participation-hint-${item.teamId}`}>
        {t(`competition.detail.participationHint.${item.status}` as never)}
      </AppText>
      <View style={[styles.details,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="wallet-outline" size={16} color={colors.textMuted}/>
        <AppText variant="caption" muted>
          {t("competition.phase3.feeStatus")}: {t(`competition.feeStatus.${item.feeStatus}` as never)}
        </AppText>
      </View>
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
    </View>)}
  </View>;
}
const styles=StyleSheet.create({
  wrapper:{gap:spacing.sm},
  card:{borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,
    borderRadius:radius.md,padding:spacing.sm,gap:spacing.sm},
  heading:{alignItems:"center",gap:spacing.sm},
  text:{flex:1,minWidth:0,gap:3},
  badge:{borderRadius:radius.pill,paddingVertical:5,paddingHorizontal:7,maxWidth:"42%"},
  active:{backgroundColor:"#E5F5E9"},inactive:{backgroundColor:colors.surfaceMuted},
  badgeText:{color:colors.primary,textAlign:"center"},
  details:{alignItems:"center",gap:6},
  actions:{gap:spacing.sm},
  button:{minHeight:44,borderRadius:radius.sm,borderWidth:1,paddingHorizontal:spacing.md,
    alignItems:"center",justifyContent:"center",flexGrow:1},
  primary:{backgroundColor:colors.primary,borderColor:colors.primary},
  secondary:{backgroundColor:colors.surface,borderColor:colors.primary},
  primaryText:{color:"#FFFFFF",textAlign:"center"},
  secondaryText:{color:colors.primary,textAlign:"center"},
  disabled:{opacity:.5},
});
