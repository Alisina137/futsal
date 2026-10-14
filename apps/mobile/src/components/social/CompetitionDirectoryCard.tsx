import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {CompetitionListItemDto} from "@leaguekick/contracts";
import {Image,Pressable,StyleSheet,View} from "react-native";
import {formatLocalDateTimeParts} from "../../lib/date-time";
import {resolveMediaImageUrl} from "../../lib/api";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";

type Props={
  competition:CompetitionListItemDto;
  detailsLabel:string;
  actionLabel:string;
  onDetails:()=>void;
  onAction:()=>void;
};

/** Image is always the top-LEFT square, while all subsequent rows span the
 * full card. This layout deliberately differs from the venue/team 25/75 grid. */
export function CompetitionDirectoryCard({
  competition,detailsLabel,actionLabel,onDetails,onAction,
}:Props){
  const {t,isRTL,language}=useLocale();
  // Preserve the user's 144px top-left square: permanent logo first,
  // then organizer cover, then the genuine published-photo fallback from discovery.
  const cover=resolveMediaImageUrl(competition.logoUrl??competition.coverImageUrl??null);
  const kickoff=competition.status==="REGISTRATION_OPEN"?
    competition.registrationClosesAt:competition.startsAt;
  const schedule=kickoff?formatLocalDateTimeParts(kickoff,language):null;
  const statusTone=competition.status==="REGISTRATION_OPEN"?"open":
    competition.status==="IN_PROGRESS"?"live":
    competition.status==="COMPLETED"?"finished":"neutral";
  return <View testID={`competition-directory-card-${competition.id}`} style={styles.card}>
    <View testID="competition-card-header" style={styles.header}>
      <Pressable accessibilityRole="button"
        accessibilityLabel={`${detailsLabel}: ${competition.name}`}
        onPress={onDetails} style={styles.photo}>
        {cover?<Image source={{uri:cover}} style={styles.image} resizeMode="cover"/>:
          <View style={styles.fallback}><Ionicons name="trophy-outline" size={35}
            color={colors.primary}/></View>}
      </Pressable>
      <View style={[styles.identity,{alignItems:isRTL?"flex-end":"flex-start"}]}>
        <Pressable accessibilityRole="button" onPress={onDetails}>
          <AppText variant="bodyLarge" weight="bold" numberOfLines={2}
            style={{textAlign:isRTL?"right":"left"}}>{competition.name}</AppText>
        </Pressable>
        <View style={styles.venue}>
          <Ionicons name="location-outline" size={15} color={colors.textMuted}/>
          <AppText variant="caption" muted numberOfLines={2}
            style={{flexShrink:1,textAlign:isRTL?"right":"left"}}>{competition.venueName}</AppText>
        </View>
      </View>
    </View>

    <View testID="competition-card-info" style={styles.info}>
      <View style={[styles.chips,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={[styles.statusChip,statusTone==="open"?styles.open:
          statusTone==="live"?styles.live:statusTone==="finished"?styles.finished:styles.neutral]}>
          <AppText variant="caption" weight="semibold" numberOfLines={1}
            style={styles.statusText}>{t(`competition.status.${competition.status}` as never)}</AppText>
        </View>
        <View style={styles.formatChip}>
          <Ionicons name="trophy-outline" size={14} color={colors.primary}/>
          <AppText variant="caption" numberOfLines={1}
            style={{color:colors.primary}}>{t(`competition.format.${competition.format}` as never)}</AppText>
        </View>
      </View>
      <View style={[styles.facts,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.fact}>
          <Ionicons name="people-outline" size={15} color={colors.textMuted}/>
          <AppText variant="caption" numberOfLines={1}>
            {competition.acceptedTeams}/{competition.maxTeams} {t("competition.phase1.teamsShort")}
          </AppText>
        </View>
        <View style={styles.fact}>
          <Ionicons name="wallet-outline" size={15} color={colors.textMuted}/>
          <AppText variant="caption" numberOfLines={1}>
            {competition.registrationFeeAfn===0?
              t("competition.profile.free"):`${competition.registrationFeeAfn} AFN`}
          </AppText>
        </View>
      </View>
      {schedule?<View style={[styles.schedule,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="calendar-outline" size={15} color={colors.textMuted}/>
        <AppText variant="caption" muted numberOfLines={2} style={{flex:1}}>
          {t(competition.status==="REGISTRATION_OPEN"?
            "competition.phase1.deadline":"competition.phase1.starts")}: {schedule.date} · {schedule.time}
        </AppText>
      </View>:null}
    </View>
    <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Pressable testID={`competition-card-details-${competition.id}`}
        accessibilityRole="button" onPress={onDetails}
        accessibilityLabel={`${detailsLabel}: ${competition.name}`}
        style={({pressed})=>[styles.button,styles.outline,pressed&&styles.pressed]}>
        <AppText variant="caption" weight="semibold" numberOfLines={2}
          style={styles.outlineText}>{detailsLabel}</AppText>
      </Pressable>
      <Pressable testID={`competition-card-action-${competition.id}`}
        accessibilityRole="button" onPress={onAction}
        accessibilityLabel={`${actionLabel}: ${competition.name}`}
        style={({pressed})=>[styles.button,styles.primary,pressed&&styles.pressed]}>
        <AppText variant="caption" weight="semibold" numberOfLines={2}
          style={styles.primaryText}>{actionLabel}</AppText>
      </Pressable>
    </View>
  </View>;
}
// 144px square ≈ half of the resulting ~290px card height.
const IMAGE_SIZE=144;
const styles=StyleSheet.create({
  card:{width:"100%",minHeight:288,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,
    backgroundColor:colors.surface,padding:spacing.sm,gap:spacing.sm},
  header:{flexDirection:"row",alignItems:"flex-start",gap:spacing.sm},
  photo:{width:IMAGE_SIZE,height:IMAGE_SIZE,aspectRatio:1,borderRadius:radius.md,
    overflow:"hidden",backgroundColor:colors.primarySoft},
  image:{width:"100%",height:"100%"},
  fallback:{flex:1,alignItems:"center",justifyContent:"center"},
  identity:{flex:1,minWidth:0,gap:spacing.xs,paddingTop:spacing.xs},
  venue:{flexDirection:"row",alignItems:"center",gap:4,minWidth:0},
  info:{gap:spacing.xs},
  chips:{alignItems:"center",flexWrap:"wrap",gap:spacing.xs},
  statusChip:{borderRadius:radius.pill,paddingHorizontal:spacing.sm,paddingVertical:4,
    maxWidth:"100%"},
  statusText:{color:colors.primary},
  open:{backgroundColor:"#E8F7EF"},live:{backgroundColor:"#FDE8E8"},
  finished:{backgroundColor:colors.primarySoft},neutral:{backgroundColor:colors.surfaceMuted},
  formatChip:{flexDirection:"row",alignItems:"center",gap:4,
    backgroundColor:colors.primarySoft,borderRadius:radius.pill,
    paddingHorizontal:spacing.sm,paddingVertical:4,maxWidth:"100%"},
  facts:{alignItems:"center",flexWrap:"wrap",gap:spacing.md},
  fact:{flexDirection:"row",gap:4,alignItems:"center"},
  schedule:{alignItems:"center",gap:5},
  actions:{gap:spacing.sm},
  button:{flex:1,minWidth:0,minHeight:44,borderRadius:radius.sm,borderWidth:1,
    alignItems:"center",justifyContent:"center",paddingHorizontal:spacing.xs,paddingVertical:4},
  outline:{backgroundColor:colors.surface,borderColor:colors.primary},
  primary:{backgroundColor:colors.primary,borderColor:colors.primary},
  outlineText:{color:colors.primary,textAlign:"center"},
  primaryText:{color:"#FFFFFF",textAlign:"center"},
  pressed:{opacity:.75},
});
