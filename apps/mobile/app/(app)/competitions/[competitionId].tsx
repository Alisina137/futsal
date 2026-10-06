import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { CompetitionDto, SocialFollowStateDto, TeamListItemDto } from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { competitionApi, marketingApi, teamApi } from "../../../src/lib/api";
import { formatLocalDateTimeParts } from "../../../src/lib/date-time";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function CompetitionDetailScreen(){
  const {competitionId}=useLocalSearchParams<{competitionId:string}>();
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const [competition,setCompetition]=useState<CompetitionDto|null>(null);
  const [myTeams,setMyTeams]=useState<TeamListItemDto[]>([]);
  const [selectedTeamId,setSelectedTeamId]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const [followState,setFollowState]=useState<SocialFollowStateDto|null>(null);
  const [followBusy,setFollowBusy]=useState(false);

  const load=useCallback(async()=>{
    if(!competitionId)return;
    setLoading(true);setError(null);
    try{
      const {competition:next}=await competitionApi.get(competitionId);
      setCompetition(next);
      if(session){
        try{
          const teams=(await teamApi.mine(session.accessToken)).teams.filter((team)=>team.managerUserId===session.user.id);
          setMyTeams(teams);
          setSelectedTeamId((current)=>current??teams[0]?.id??null);
        }catch{setMyTeams([]);}
      }
    }catch{setError(t("competition.loadError"));}
    finally{setLoading(false);}
  },[competitionId,session,t]);

  useEffect(()=>{void load();},[load]);

  useEffect(()=>{
    if(!session||!competitionId)return;
    marketingApi.socialFollowState(session.accessToken,"COMPETITION",competitionId).then(setFollowState).catch(()=>{});
  },[competitionId,session]);

  async function toggleFollow(){
    if(!session||!competitionId||!followState)return;
    setFollowBusy(true);setError(null);
    try{
      setFollowState(followState.following
        ?await marketingApi.socialUnfollow(session.accessToken,"COMPETITION",competitionId)
        :await marketingApi.socialFollow(session.accessToken,"COMPETITION",competitionId));
    }catch{
      setError(t("social.followError"));
    }finally{setFollowBusy(false);}
  }

  const fixtures=useMemo(()=>competition?.matches.slice().sort((a,b)=>
    a.stage.localeCompare(b.stage)||b.roundNumber-a.roundNumber||a.slotNumber-b.slotNumber
  )??[],[competition?.matches]);

  async function register(){
    if(!session||!competitionId||!selectedTeamId)return;
    setBusy(true);setError(null);setMessage(null);
    try{
      await competitionApi.register(session.accessToken,competitionId,selectedTeamId);
      setMessage(t("competition.registrationSent"));
    }catch{setError(t("competition.registrationError"));}
    finally{setBusy(false);}
  }

  const starts=competition?.startsAt?formatLocalDateTimeParts(competition.startsAt,language):null;

  return <Screen showHeader>
    {loading?<AppText>{t("common.loading")}</AppText>:null}
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}

    {competition?<>
      <Card style={{backgroundColor:colors.primary}}>
        <View style={{gap:spacing.sm}}>
          <View style={{flexDirection:isRTL?"row-reverse":"row",justifyContent:"space-between",gap:spacing.sm,alignItems:"flex-start"}}>
            <View style={{flex:1,gap:2}}>
              <AppText variant="title" weight="bold" style={{color:"#FFFFFF"}}>{competition.name}</AppText>
              <AppText style={{color:"#DCE8FF"}}>{competition.venueName}</AppText>
            </View>
            <View style={{paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,borderRadius:radius.pill,backgroundColor:"#FFFFFF"}}>
              <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
                {t(`competition.format.${competition.format}` as never)}
              </AppText>
            </View>
          </View>
          <AppText weight="semibold" style={{color:"#FFFFFF"}}>{t(`competition.status.${competition.status}` as never)}</AppText>
          {competition.description?<AppText style={{color:"#DCE8FF"}}>{competition.description}</AppText>:null}
          {starts?<View style={{gap:2}}>
            <AppText variant="caption" style={{color:"#DCE8FF"}}>{starts.date}</AppText>
            <AppText variant="caption" style={{color:"#DCE8FF"}}>{starts.time}</AppText>
          </View>:null}
          {competition.championTeamId?<AppText weight="bold" style={{color:"#FFFFFF"}}>{t("competition.champion")}: {competition.teams.find((team)=>team.teamId===competition.championTeamId)?.teamName??"—"}</AppText>:null}
        </View>
      </Card>

      {followState?<View style={{gap:spacing.xs}}>
        <Button
          label={followState.following?t("social.unfollow"):t("social.follow")}
          onPress={()=>void toggleFollow()}
          loading={followBusy}
          variant={followState.following?"secondary":"primary"}
        />
        <AppText variant="caption" muted>{t("social.followers",{count:followState.followerCount})}</AppText>
      </View>:null}

      <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm,flexWrap:"wrap"}}>
        <Button label={t("competition.standings")} onPress={()=>router.push({pathname:"/competitions/[competitionId]/standings",params:{competitionId}})} variant="secondary"/>
        <Button label={t("competition.bracket")} onPress={()=>router.push({pathname:"/competitions/[competitionId]/bracket",params:{competitionId}})} variant="secondary"/>
        <Button label={t("competition.teams")} onPress={()=>router.push({pathname:"/competitions/[competitionId]/teams",params:{competitionId}})} variant="secondary"/>
        <Button label={t("competition.stats")} onPress={()=>router.push({pathname:"/competitions/[competitionId]/stats",params:{competitionId}})} variant="secondary"/>
      </View>

      {competition.status==="REGISTRATION_OPEN"&&session?<Card>
        <AppText variant="bodyLarge" weight="bold">{t("competition.register")}</AppText>
        <AppText muted>{t("competition.selectTeam")}</AppText>
        {myTeams.length===0?<AppText>{t("competition.noTeamsForRegistration")}</AppText>:null}
        {myTeams.map((team)=><Pressable
          key={team.id}
          onPress={()=>setSelectedTeamId(team.id)}
          style={{
            padding:spacing.md,borderRadius:radius.md,borderWidth:1,
            borderColor:selectedTeamId===team.id?colors.primary:colors.border,
            backgroundColor:selectedTeamId===team.id?colors.primarySoft:colors.surface,
          }}
        >
          <AppText weight="semibold" style={selectedTeamId===team.id?{color:colors.primary}:undefined}>{team.name}</AppText>
          <AppText variant="caption" muted>{team.city}</AppText>
        </Pressable>)}
        <Button label={t("competition.register")} onPress={()=>void register()} loading={busy} disabled={!selectedTeamId}/>
        {message?<AppText style={{color:colors.success}}>{message}</AppText>:null}
      </Card>:null}

      <View style={{gap:spacing.xs}}>
        <AppText variant="bodyLarge" weight="bold">{t("competition.fixtures")}</AppText>
        {fixtures.length===0?<AppText muted>{t("competition.noFixtures")}</AppText>:null}
      </View>

      {fixtures.map((match)=>{
        const when=match.startsAt?formatLocalDateTimeParts(match.startsAt,language):null;
        return <Card key={match.id}>
          <View style={{flexDirection:isRTL?"row-reverse":"row",justifyContent:"space-between",gap:spacing.sm}}>
            <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
              {match.groupName?t("competition.group",{name:match.groupName}):t("competition.round",{number:match.roundNumber})}
            </AppText>
            <AppText variant="caption" muted>{t(`competition.matchStatus.${match.status}` as never)}</AppText>
          </View>
          <View style={{flexDirection:isRTL?"row-reverse":"row",justifyContent:"space-between",alignItems:"center",gap:spacing.sm}}>
            <AppText weight="bold" style={{flex:1}}>{match.homeTeamName??t("competition.tbd")}</AppText>
            <AppText variant="bodyLarge" weight="bold" forceLtr>
              {match.homeScore===null||match.awayScore===null?"—":`${match.homeScore} - ${match.awayScore}`}
            </AppText>
            <AppText weight="bold" style={{flex:1,textAlign:isRTL?"left":"right"}}>{match.awayTeamName??t("competition.tbd")}</AppText>
          </View>
          {when?<View style={{gap:2}}>
            <AppText variant="caption" muted>{when.date}</AppText>
            <AppText variant="caption" muted>{when.time}{match.areaName?` · ${match.areaName}`:""}</AppText>
          </View>:null}
        </Card>;
      })}
    </>:null}
  </Screen>;
}
