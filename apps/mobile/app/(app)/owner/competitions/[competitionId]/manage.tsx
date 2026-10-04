import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type {
  CompetitionDto,
  CompetitionMatchDto,
  CompetitionStateRequest,
} from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { competitionApi, ownerApi } from "../../../../../src/lib/api";
import { formatLocalDateTimeParts } from "../../../../../src/lib/date-time";
import { AppText } from "../../../../../src/components/ui/AppText";
import { Button } from "../../../../../src/components/ui/Button";
import { Card } from "../../../../../src/components/ui/Card";
import { Screen } from "../../../../../src/components/ui/Screen";
import { TextField } from "../../../../../src/components/ui/TextField";
import { useAuth } from "../../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../../src/providers/LocaleProvider";

type EditMode="SCHEDULE"|"RESULT"|null;

export default function ManageCompetitionScreen(){
  const {competitionId}=useLocalSearchParams<{competitionId:string}>();
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const [competition,setCompetition]=useState<CompetitionDto|null>(null);
  const [areas,setAreas]=useState<Array<{id:string;name:string}>>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);

  const [inviteTeamId,setInviteTeamId]=useState("");
  const [inviteSeed,setInviteSeed]=useState("");

  const [activeMatch,setActiveMatch]=useState<CompetitionMatchDto|null>(null);
  const [editMode,setEditMode]=useState<EditMode>(null);
  const [areaId,setAreaId]=useState("");
  const [startsAt,setStartsAt]=useState("");
  const [endsAt,setEndsAt]=useState("");
  const [homeScore,setHomeScore]=useState("");
  const [awayScore,setAwayScore]=useState("");
  const [correctionReason,setCorrectionReason]=useState("");
  const [confirmImpact,setConfirmImpact]=useState(false);

  const load=useCallback(async()=>{
    if(!session||!competitionId)return;
    setLoading(true);setError(null);
    try{
      const [{competition:next},status]=await Promise.all([
        competitionApi.ownerGet(session.accessToken,competitionId),
        ownerApi.getStatus(session.accessToken),
      ]);
      setCompetition(next);
      setAreas(status.venue?.areas.filter((item)=>item.active).map((item)=>({id:item.id,name:item.name}))??[]);
      setAreaId((current)=>current||status.venue?.areas.find((item)=>item.active)?.id||"");
    }catch{setError(t("competition.loadError"));}
    finally{setLoading(false);}
  },[competitionId,session,t]);

  useEffect(()=>{void load();},[load]);

  const pending=useMemo(()=>competition?.teams.filter((team)=>team.status==="APPLIED"||team.status==="PENDING")??[],[competition]);
  const matches=useMemo(()=>competition?.matches.slice().sort((a,b)=>
    a.stage.localeCompare(b.stage)||b.roundNumber-a.roundNumber||a.slotNumber-b.slotNumber
  )??[],[competition]);

  async function action(action:CompetitionStateRequest["action"]){
    if(!session||!competitionId)return;
    setBusy(action);setError(null);
    try{
      const {competition:next}=await competitionApi.changeState(session.accessToken,competitionId,{action});
      setCompetition(next);
    }catch{setError(t("competition.stateError"));}
    finally{setBusy(null);}
  }

  async function decide(teamId:string,status:"ACCEPTED"|"REJECTED"){
    if(!session||!competitionId)return;
    setBusy(`registration:${teamId}`);setError(null);
    try{
      await competitionApi.decideRegistration(session.accessToken,competitionId,teamId,{status});
      await load();
    }catch{setError(t("competition.stateError"));}
    finally{setBusy(null);}
  }

  async function invite(){
    if(!session||!competitionId||!inviteTeamId.trim())return;
    const seed=inviteSeed.trim()?Number(inviteSeed):null;
    setBusy("invite");setError(null);
    try{
      await competitionApi.inviteTeam(session.accessToken,competitionId,{
        teamId:inviteTeamId.trim(),
        seed:Number.isInteger(seed)?seed:null,
      });
      setInviteTeamId("");setInviteSeed("");
      await load();
    }catch{setError(t("competition.inviteError"));}
    finally{setBusy(null);}
  }

  function openSchedule(match:CompetitionMatchDto){
    setActiveMatch(match);setEditMode("SCHEDULE");
    setAreaId(match.areaId??areas[0]?.id??"");
    setStartsAt(match.startsAt??"");
    setEndsAt(match.endsAt??"");
  }

  function openResult(match:CompetitionMatchDto){
    setActiveMatch(match);setEditMode("RESULT");
    setHomeScore(match.homeScore===null?"":String(match.homeScore));
    setAwayScore(match.awayScore===null?"":String(match.awayScore));
    setCorrectionReason("");
    setConfirmImpact(false);
  }

  async function saveSchedule(){
    if(!session||!competitionId||!activeMatch||!areaId||!startsAt||!endsAt)return;
    setBusy("schedule");setError(null);
    try{
      const {competition:next}=await competitionApi.scheduleMatch(session.accessToken,competitionId,activeMatch.id,{areaId,startsAt,endsAt});
      setCompetition(next);setActiveMatch(null);setEditMode(null);
    }catch{setError(t("competition.scheduleError"));}
    finally{setBusy(null);}
  }

  async function saveResult(){
    if(!session||!competitionId||!activeMatch)return;
    const home=Number(homeScore),away=Number(awayScore);
    if(!Number.isInteger(home)||home<0||!Number.isInteger(away)||away<0){setError(t("competition.resultError"));return;}
    setBusy("result");setError(null);
    try{
      const result=await competitionApi.enterResult(session.accessToken,competitionId,activeMatch.id,{
        homeScore:home,
        awayScore:away,
        correctionReason:correctionReason.trim()||undefined,
        confirmImpact,
        playerStats:[],
      });
      setCompetition(result.competition);setActiveMatch(null);setEditMode(null);
    }catch{setError(t("competition.resultError"));}
    finally{setBusy(null);}
  }

  function availableActions():CompetitionStateRequest["action"][]{
    if(!competition)return[];
    if(competition.status==="DRAFT")return["OPEN_REGISTRATION"];
    if(competition.status==="REGISTRATION_OPEN")return["CLOSE_REGISTRATION","UNPUBLISH"];
    if(competition.status==="REGISTRATION_CLOSED")return["GENERATE_FIXTURES"];
    if((competition.status==="SCHEDULED"||competition.status==="IN_PROGRESS")&&competition.format==="GROUP_KNOCKOUT"&&competition.matches.some((m)=>m.stage==="GROUP")&&!competition.matches.some((m)=>m.stage==="KNOCKOUT"))return["GENERATE_KNOCKOUT","COMPLETE"];
    if(competition.status==="SCHEDULED"||competition.status==="IN_PROGRESS")return["COMPLETE"];
    if(competition.status==="COMPLETED")return["ARCHIVE"];
    return[];
  }

  return <Screen showHeader>
    {loading?<AppText>{t("common.loading")}</AppText>:null}
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}

    {competition?<>
      <Card style={{backgroundColor:colors.primary}}>
        <AppText variant="title" weight="bold" style={{color:"#FFFFFF"}}>{competition.name}</AppText>
        <AppText style={{color:"#DCE8FF"}}>{t(`competition.format.${competition.format}` as never)} · {t(`competition.status.${competition.status}` as never)}</AppText>
        <AppText style={{color:"#DCE8FF"}}>{t("competition.acceptedTeams",{count:competition.teams.filter((team)=>team.status==="ACCEPTED").length,max:competition.maxTeams})}</AppText>
      </Card>

      <Card>
        <AppText variant="bodyLarge" weight="bold">{t("competition.manage")}</AppText>
        <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm,flexWrap:"wrap"}}>
          {availableActions().map((value)=><Button
            key={value}
            label={value==="OPEN_REGISTRATION"?t("competition.openRegistration"):
              value==="CLOSE_REGISTRATION"?t("competition.closeRegistration"):
              value==="GENERATE_FIXTURES"?t("competition.generateFixtures"):
              value==="GENERATE_KNOCKOUT"?t("competition.generateKnockout"):
              value==="COMPLETE"?t("competition.complete"):
              value==="ARCHIVE"?t("competition.archive"):
              value==="UNPUBLISH"?t("competition.unpublish"):
              t("competition.publish")}
            onPress={()=>void action(value)}
            loading={busy===value}
            variant="secondary"
          />)}
        </View>
        <Button label={t("competition.open")} onPress={()=>router.push({pathname:"/competitions/[competitionId]",params:{competitionId}})} variant="ghost"/>
      </Card>

      {["DRAFT","REGISTRATION_OPEN","REGISTRATION_CLOSED"].includes(competition.status)?<Card>
        <AppText variant="bodyLarge" weight="bold">{t("competition.inviteTeam")}</AppText>
        <TextField label={t("competition.teamId")} value={inviteTeamId} onChangeText={setInviteTeamId} autoCapitalize="none" forceLtr/>
        <TextField label={t("competition.seed")} value={inviteSeed} onChangeText={setInviteSeed} keyboardType="number-pad" forceLtr/>
        <Button label={t("competition.inviteTeam")} onPress={()=>void invite()} loading={busy==="invite"} disabled={!inviteTeamId.trim()}/>
      </Card>:null}

      {pending.length>0?<Card>
        <AppText variant="bodyLarge" weight="bold">{t("competition.pendingApplications")}</AppText>
        {pending.map((team)=><View key={team.teamId} style={{gap:spacing.sm,paddingVertical:spacing.sm,borderTopWidth:1,borderTopColor:colors.border}}>
          <AppText weight="bold">{team.teamName}</AppText>
          <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
            <Button label={t("competition.accept")} onPress={()=>void decide(team.teamId,"ACCEPTED")} loading={busy===`registration:${team.teamId}`} style={{flex:1}}/>
            <Button label={t("competition.reject")} onPress={()=>void decide(team.teamId,"REJECTED")} variant="secondary" style={{flex:1}}/>
          </View>
        </View>)}
      </Card>:null}

      <View style={{gap:spacing.xs}}>
        <AppText variant="bodyLarge" weight="bold">{t("competition.fixtures")}</AppText>
        {matches.length===0?<AppText muted>{t("competition.noFixtures")}</AppText>:null}
      </View>

      {matches.map((match)=>{
        const when=match.startsAt?formatLocalDateTimeParts(match.startsAt,language):null;
        return <Card key={match.id}>
          <View style={{flexDirection:isRTL?"row-reverse":"row",justifyContent:"space-between",gap:spacing.sm}}>
            <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>{match.groupName?t("competition.group",{name:match.groupName}):t("competition.round",{number:match.roundNumber})}</AppText>
            <AppText variant="caption" muted>{match.status}</AppText>
          </View>
          <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
            <AppText weight="bold" style={{flex:1}}>{match.homeTeamName??t("competition.tbd")}</AppText>
            <AppText variant="bodyLarge" weight="bold" forceLtr>{match.homeScore===null||match.awayScore===null?"—":`${match.homeScore} - ${match.awayScore}`}</AppText>
            <AppText weight="bold" style={{flex:1,textAlign:isRTL?"left":"right"}}>{match.awayTeamName??t("competition.tbd")}</AppText>
          </View>
          {when?<AppText variant="caption" muted>{when.date} · {when.time}{match.areaName?` · ${match.areaName}`:""}</AppText>:null}
          {match.homeTeamId&&match.awayTeamId?<View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
            <Button label={t("competition.scheduleMatch")} onPress={()=>openSchedule(match)} variant="secondary" style={{flex:1}}/>
            <Button label={t("competition.enterResult")} onPress={()=>openResult(match)} variant="secondary" style={{flex:1}}/>
          </View>:null}
        </Card>;
      })}

      {activeMatch&&editMode==="SCHEDULE"?<Card style={{borderColor:colors.primary}}>
        <AppText variant="bodyLarge" weight="bold">{t("competition.scheduleMatch")}</AppText>
        <AppText>{activeMatch.homeTeamName??t("competition.tbd")} — {activeMatch.awayTeamName??t("competition.tbd")}</AppText>
        <AppText weight="semibold">{t("competition.area")}</AppText>
        <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm,flexWrap:"wrap"}}>
          {areas.map((area)=><Pressable
            key={area.id}
            onPress={()=>setAreaId(area.id)}
            style={{padding:spacing.sm,borderRadius:radius.md,borderWidth:1,borderColor:areaId===area.id?colors.primary:colors.border,backgroundColor:areaId===area.id?colors.primarySoft:colors.surface}}
          ><AppText>{area.name}</AppText></Pressable>)}
        </View>
        <TextField label={t("competition.startsAt")} value={startsAt} onChangeText={setStartsAt} forceLtr placeholder="2026-10-10T18:00:00+04:30"/>
        <TextField label={t("competition.endsAt")} value={endsAt} onChangeText={setEndsAt} forceLtr placeholder="2026-10-10T19:30:00+04:30"/>
        <Button label={t("common.save")} onPress={()=>void saveSchedule()} loading={busy==="schedule"}/>
        <Button label={t("teams.cancelAction")} onPress={()=>{setActiveMatch(null);setEditMode(null);}} variant="secondary"/>
      </Card>:null}

      {activeMatch&&editMode==="RESULT"?<Card style={{borderColor:colors.primary}}>
        <AppText variant="bodyLarge" weight="bold">{t("competition.enterResult")}</AppText>
        <AppText>{activeMatch.homeTeamName??t("competition.tbd")} — {activeMatch.awayTeamName??t("competition.tbd")}</AppText>
        <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
          <TextField label={t("competition.homeScore")} value={homeScore} onChangeText={setHomeScore} keyboardType="number-pad" forceLtr containerStyle={{flex:1}}/>
          <TextField label={t("competition.awayScore")} value={awayScore} onChangeText={setAwayScore} keyboardType="number-pad" forceLtr containerStyle={{flex:1}}/>
        </View>
        {(activeMatch.status==="COMPLETED"||activeMatch.status==="CORRECTED")?<>
          <TextField label={t("competition.correctionReason")} value={correctionReason} onChangeText={setCorrectionReason}/>
          <Pressable
            onPress={()=>setConfirmImpact((value)=>!value)}
            style={{padding:spacing.md,borderRadius:radius.md,borderWidth:1,borderColor:confirmImpact?colors.primary:colors.border,backgroundColor:confirmImpact?colors.primarySoft:colors.surface}}
          >
            <AppText weight="semibold" style={confirmImpact?{color:colors.primary}:undefined}>{confirmImpact?"✓ ":""}{t("competition.confirmImpact")}</AppText>
          </Pressable>
        </>:null}
        <Button label={t("common.save")} onPress={()=>void saveResult()} loading={busy==="result"}/>
        <Button label={t("teams.cancelAction")} onPress={()=>{setActiveMatch(null);setEditMode(null);}} variant="secondary"/>
      </Card>:null}
    </>:null}
  </Screen>;
}
