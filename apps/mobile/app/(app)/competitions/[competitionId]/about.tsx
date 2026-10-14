import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {CompetitionDto} from "@leaguekick/contracts";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {useCallback,useState} from "react";
import {Pressable,StyleSheet,View} from "react-native";
import {competitionApi} from "../../../../src/lib/api";
import {formatCompetitionDateTime} from "../../../../src/lib/date-time";
import {AppText} from "../../../../src/components/ui/AppText";
import {Button} from "../../../../src/components/ui/Button";
import {Card} from "../../../../src/components/ui/Card";
import {DataLoadingState} from "../../../../src/components/ui/DataLoadingState";
import {Screen} from "../../../../src/components/ui/Screen";
import {useLocale} from "../../../../src/providers/LocaleProvider";

type Icon=keyof typeof Ionicons.glyphMap;
function AboutSection({title,icon,children}:{title:string;icon:Icon;children:React.ReactNode}){
  const {isRTL}=useLocale();
  return <Card style={styles.section}>
    <View style={[styles.sectionHead,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={styles.icon}><Ionicons name={icon} color={colors.primary} size={21}/></View>
      <AppText weight="bold" variant="bodyLarge" style={{flex:1}}>{title}</AppText>
    </View>
    {children}
  </Card>;
}
function Info({label,value,onPress}:{label:string;value:string;onPress?:()=>void}){
  const {isRTL}=useLocale();
  const content=<View style={[styles.info,{flexDirection:isRTL?"row-reverse":"row"}]}>
    <AppText variant="caption" muted style={{flex:1}}>{label}</AppText>
    <AppText weight="semibold" style={styles.value}>{value}</AppText>
    {onPress?<Ionicons name={isRTL?"chevron-back":"chevron-forward"}
      size={18} color={colors.primary}/>:null}
  </View>;
  return onPress?<Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}
    onPress={onPress} style={({pressed})=>pressed?styles.pressed:undefined}>{content}</Pressable>:content;
}

export default function CompetitionAboutScreen(){
  const {competitionId}=useLocalSearchParams<{competitionId:string}>();
  const {t,isRTL,language}=useLocale();
  const [data,setData]=useState<CompetitionDto|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [retry,setRetry]=useState(0);

  useFocusEffect(useCallback(()=>{
    let active=true;
    if(!competitionId){setLoading(false);setError(t("competition.loadError"));return()=>{active=false;};}
    setLoading(true);setError(null);
    void competitionApi.get(competitionId).then(result=>{
      if(active)setData(result.competition);
    }).catch(()=>{
      if(active){setData(null);setError(t("competition.loadError"));}
    }).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[competitionId,retry,t]));

  const date=(value:string|null)=>{
    if(!value)return t("competition.profile.notSet");
    return formatCompetitionDateTime(value,language);
  };
  const accepted=data?.teams.filter(x=>x.status==="ACCEPTED")??[];
  const finished=data?.matches.filter(x=>x.status==="COMPLETED"||x.status==="CORRECTED").length??0;
  const live=data?.matches.filter(x=>x.status==="IN_PROGRESS").length??0;
  const champion=data?.teams.find(x=>x.teamId===data.championTeamId);
  const order=data?.tieBreakOrder.map(rule=>t(`competition.profile.tieBreak.${rule}` as never)).join(" · ")??"";
  const capacityRatio=data?.maxTeams?Math.min(1,accepted.length/data.maxTeams):0;

  return <Screen showHeader style={styles.page}>
    <View style={[styles.header,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Pressable accessibilityRole="button"
        accessibilityLabel={t("competition.profile.backToProfile")}
        onPress={()=>router.push({pathname:"/competitions/[competitionId]",params:{competitionId}})}
        style={styles.back}>
        <Ionicons name={isRTL?"arrow-forward":"arrow-back"} color={colors.primary} size={21}/>
      </Pressable>
      <View style={{flex:1,gap:3}}>
        <AppText weight="bold" variant="bodyLarge">{t("competition.profile.about")}</AppText>
        {data?<AppText variant="caption" muted numberOfLines={2}>{data.name}</AppText>:null}
      </View>
    </View>
    {loading?<DataLoadingState variant="detail" minHeight={440}/>:null}
    {!loading&&!data?<Card style={styles.section}>
      <AppText>{error??t("competition.loadError")}</AppText>
      <Button label={t("common.retry")} onPress={()=>setRetry(n=>n+1)}/>
    </Card>:null}
    {data?<>
      <Card testID="competition-about-at-a-glance" style={styles.glance}>
        <View style={[styles.glanceHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.glanceIcon}><Ionicons name="trophy-outline" color={colors.primary} size={28}/></View>
          <View style={{flex:1,gap:4,minWidth:0}}>
            <AppText variant="bodyLarge" weight="bold" numberOfLines={3}>{data.name}</AppText>
            <AppText variant="caption" muted>{data.venueName}</AppText>
          </View>
        </View>
        <View style={[styles.glanceBadges,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.glancePill}><AppText variant="caption" weight="semibold"
            style={{color:colors.primary}}>
            {t(`competition.status.${data.status}` as never)}
          </AppText></View>
          <View style={styles.glancePill}><AppText variant="caption" weight="semibold"
            style={{color:colors.primary}}>
            {t(`competition.format.${data.format}` as never)}
          </AppText></View>
        </View>
        <View style={[styles.glanceDetails,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.glanceDetail}>
            <AppText variant="caption" muted>{t("competition.startsAt")}</AppText>
            <AppText weight="semibold" numberOfLines={3}>{date(data.startsAt)}</AppText>
          </View>
          <View style={styles.glanceDetail}>
            <AppText variant="caption" muted>{t("competition.registrationFee")}</AppText>
            <AppText weight="semibold">{data.registrationFeeAfn===0?
              t("competition.profile.free"):`${data.registrationFeeAfn} AFN`}</AppText>
          </View>
        </View>
        <View style={[styles.progressHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <AppText variant="caption" muted>{t("competition.profile.registeredTeams")}</AppText>
          <AppText variant="caption" weight="bold" style={{color:colors.primary}}>
            {accepted.length}/{data.maxTeams}
          </AppText>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill,{width:`${Math.round(capacityRatio*100)}%`}]}/>
        </View>
        <View style={[styles.glanceActions,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Button label={t("competition.phase4.viewFixtures")} variant="secondary"
            onPress={()=>router.push({pathname:"/competitions/[competitionId]",
              params:{competitionId,tab:"MATCHES"}})} style={{flex:1}}/>
          <Button label={t("competition.teams")} variant="secondary"
            onPress={()=>router.push({pathname:"/competitions/[competitionId]",
              params:{competitionId,tab:"TEAMS"}})} style={{flex:1}}/>
        </View>
      </Card>
      <AboutSection title={t("competition.profile.overview")} icon="information-circle-outline">
        <AppText weight="bold" variant="bodyLarge">{data.name}</AppText>
        {data.description?<AppText>{data.description}</AppText>:
          <AppText muted>{t("competition.profile.noDescription")}</AppText>}
        <Info label={t("competition.format")}
          value={t(`competition.format.${data.format}` as never)}/>
        <Info label={t("competition.profile.currentStatus")}
          value={t(`competition.status.${data.status}` as never)}/>
        <Info label={t("competition.profile.hostVenue")} value={data.venueName}
          onPress={()=>router.push({pathname:"/venues/[venueId]",params:{venueId:data.venueId}})}/>
      </AboutSection>

      <AboutSection title={t("competition.profile.registrationInfo")} icon="people-outline">
        <Info label={t("competition.profile.registeredTeams")}
          value={t("competition.acceptedTeams",{count:accepted.length,max:data.maxTeams})}/>
        <Info label={t("competition.registrationFee")}
          value={data.registrationFeeAfn===0?t("competition.profile.free"):
            `${data.registrationFeeAfn} AFN`}/>
        <Info label={t("competition.registrationDeadline")} value={date(data.registrationClosesAt)}/>
        <Info label={t("competition.profile.registrationStatus")}
          value={t(data.status==="REGISTRATION_OPEN"
            ?"competition.status.REGISTRATION_OPEN":"competition.profile.registrationNotOpen")}/>
        {data.status==="REGISTRATION_OPEN"&&(!data.registrationClosesAt||Date.parse(data.registrationClosesAt)>Date.now())&&accepted.length<data.maxTeams?<Button label={t("competition.register")} onPress={()=>
          router.push({pathname:"/competitions/[competitionId]",
            params:{competitionId,tab:"TEAMS",focusRegistration:"1"}})}/>:null}
      </AboutSection>

      <AboutSection title={t("competition.rewards.title")} icon="gift-outline">
        {data.rewards.length===0?<AppText muted>{t("competition.rewards.empty")}</AppText>:null}
        {(["TEAM","INDIVIDUAL"] as const).map(category=>{
          const rewards=data.rewards.filter(reward=>reward.category===category);
          if(!rewards.length)return null;
          return <View key={category} style={styles.rewardGroup}>
            <View style={[styles.rewardGroupHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Ionicons name={category==="TEAM"?"people-outline":"person-outline"}
                size={18} color={colors.primary}/>
              <AppText weight="bold" style={{flex:1}}>
                {t(`competition.rewards.category.${category}`)}
              </AppText>
            </View>
            {rewards.map((reward,index)=><View key={`${category}-${index}`} style={styles.rewardItem}>
              <View style={[styles.rewardHead,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <View style={styles.rewardIcon}><Ionicons name="trophy-outline" size={20} color={colors.primary}/></View>
                <View style={{flex:1,gap:4}}>
                  <AppText weight="semibold" variant="bodyLarge">{reward.title}</AppText>
                  <AppText weight="bold" style={{color:colors.primary}}>{reward.prize}</AppText>
                </View>
              </View>
              {reward.description?<AppText muted>{reward.description}</AppText>:null}
            </View>)}
          </View>;
        })}
      </AboutSection>

      <AboutSection title={t("competition.profile.schedule")} icon="calendar-outline">
        <Info label={t("competition.startsAt")} value={date(data.startsAt)}/>
        <Info label={t("competition.endsAt")} value={date(data.endsAt)}/>
        <Info label={t("competition.matchDuration")}
          value={t("competition.profile.minutes",{count:data.matchDurationMinutes})}/>
        <Info label={t("competition.profile.totalMatches")} value={String(data.matches.length)}/>
        <Info label={t("competition.profile.completedMatches")} value={String(finished)}/>
        {live>0?<Info label={t("competition.profile.liveMatches")} value={String(live)}/>:null}
      </AboutSection>

      <AboutSection title={t("competition.profile.rules")} icon="ribbon-outline">
        <Info label={t("competition.winPoints")} value={String(data.winPoints)}/>
        <Info label={t("competition.drawPoints")} value={String(data.drawPoints)}/>
        <Info label={t("competition.lossPoints")} value={String(data.lossPoints)}/>
        <Info label={t("competition.profile.tieBreakOrder")} value={order||t("competition.profile.notSet")}/>
        {data.format==="GROUP_KNOCKOUT"?<>
          <Info label={t("competition.groupCount")}
            value={String(data.groupCount??0)}/>
          <Info label={t("competition.qualifiersPerGroup")}
            value={String(data.qualifiersPerGroup??0)}/>
        </>:null}
      </AboutSection>
      {champion?<AboutSection title={t("competition.champion")} icon="trophy-outline">
        <Info label={t("competition.champion")} value={champion.teamName}
          onPress={()=>router.push({pathname:"/teams/[teamId]",params:{teamId:champion.teamId}})}/>
      </AboutSection>:null}
    </>:null}
  </Screen>;
}
const styles=StyleSheet.create({
  page:{paddingTop:spacing.md,gap:spacing.md},
  header:{alignItems:"center",gap:spacing.sm},
  back:{width:44,height:44,borderRadius:22,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  section:{gap:spacing.md},
  sectionHead:{alignItems:"center",gap:spacing.sm},
  icon:{width:40,height:40,backgroundColor:colors.primarySoft,borderRadius:12,
    alignItems:"center",justifyContent:"center"},
  info:{minHeight:48,gap:spacing.md,alignItems:"center",paddingVertical:spacing.xs,
    borderTopWidth:1,borderTopColor:colors.border},
  value:{flex:1,textAlign:"auto"},
  pressed:{opacity:.7},
  glance:{gap:spacing.md,borderColor:colors.primary},
  glanceHeading:{alignItems:"center",gap:spacing.md},
  glanceIcon:{height:58,width:58,borderRadius:radius.md,
    backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"},
  glanceBadges:{alignItems:"center",gap:spacing.sm,flexWrap:"wrap"},
  glancePill:{paddingHorizontal:spacing.md,paddingVertical:7,
    backgroundColor:colors.primarySoft,borderRadius:radius.pill},
  glanceDetails:{gap:spacing.md,flexWrap:"wrap"},
  glanceDetail:{minWidth:126,flex:1,gap:4},
  progressHeading:{alignItems:"center",justifyContent:"space-between",gap:spacing.sm},
  progressTrack:{height:8,borderRadius:radius.pill,overflow:"hidden",backgroundColor:colors.primarySoft},
  progressFill:{height:"100%",backgroundColor:colors.primary,borderRadius:radius.pill},
  glanceActions:{alignItems:"center",gap:spacing.sm},

  rewardGroup:{gap:spacing.sm},
  rewardGroupHeading:{gap:spacing.sm,alignItems:"center"},
  rewardItem:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,
    padding:spacing.md,gap:spacing.sm,backgroundColor:colors.surface},
  rewardHead:{gap:spacing.sm,alignItems:"center"},
  rewardIcon:{width:40,height:40,borderRadius:20,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
});
