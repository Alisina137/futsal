import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type {
  CompetitionDto,
  CompetitionFeeStatus,
  CompetitionFormat,
  CompetitionMatchDto,
  CompetitionMediaPostDto,
  CompetitionStateRequest,
  CompetitionTeamDto,
  CompetitionUpdateRequest,
  TeamDirectoryItemDto,
  VenueRefereeDto,
} from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { competitionApi, ownerApi, teamApi } from "../../../../../src/lib/api";
import { formatLocalDateTimeParts } from "../../../../../src/lib/date-time";
import { AppText } from "../../../../../src/components/ui/AppText";
import { Button } from "../../../../../src/components/ui/Button";
import { Card } from "../../../../../src/components/ui/Card";
import { DataLoadingState } from "../../../../../src/components/ui/DataLoadingState";
import { DateTimePickerField } from "../../../../../src/components/ui/DateTimePickerField";
import { OwnerTopNav } from "../../../../../src/components/owner/OwnerTopNav";
import { Screen } from "../../../../../src/components/ui/Screen";
import { TextField } from "../../../../../src/components/ui/TextField";
import { useAuth } from "../../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../../src/providers/LocaleProvider";

type EditMode="SCHEDULE"|"RESULT"|null;
type ControlTab="OVERVIEW"|"TEAMS"|"FIXTURES"|"STANDINGS"|"REFEREES"|"STATISTICS"|"MEDIA"|"SETTINGS";

const tabs:Array<{key:ControlTab;icon:keyof typeof Ionicons.glyphMap}>=[
  {key:"OVERVIEW",icon:"grid-outline"},
  {key:"TEAMS",icon:"people-outline"},
  {key:"FIXTURES",icon:"calendar-outline"},
  {key:"STANDINGS",icon:"podium-outline"},
  {key:"REFEREES",icon:"flag-outline"},
  {key:"STATISTICS",icon:"stats-chart-outline"},
  {key:"MEDIA",icon:"newspaper-outline"},
  {key:"SETTINGS",icon:"settings-outline"},
];
const formats:CompetitionFormat[]=["LEAGUE","GROUP_KNOCKOUT","KNOCKOUT"];
const feeStatuses:CompetitionFeeStatus[]=["UNPAID","PENDING","PAID","WAIVED"];
const THREE_DAYS_MS=72*60*60*1000;

function after(value:string,offsetMs:number){
  const parsed=Date.parse(value);
  return Number.isFinite(parsed)?new Date(parsed+offsetMs):undefined;
}

export default function ManageCompetitionScreen(){
  const {competitionId}=useLocalSearchParams<{competitionId:string}>();
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const [activeTab,setActiveTab]=useState<ControlTab>("OVERVIEW");
  const [competition,setCompetition]=useState<CompetitionDto|null>(null);
  const [areas,setAreas]=useState<Array<{id:string;name:string}>>([]);
  const [referees,setReferees]=useState<VenueRefereeDto[]>([]);
  const [directoryTeams,setDirectoryTeams]=useState<TeamDirectoryItemDto[]>([]);
  const [mediaPosts,setMediaPosts]=useState<CompetitionMediaPostDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);

  const [feeTeamId,setFeeTeamId]=useState<string|null>(null);
  const [feeReference,setFeeReference]=useState("");
  const [seedTeamId,setSeedTeamId]=useState<string|null>(null);
  const [seedDraft,setSeedDraft]=useState("");

  const [mediaBody,setMediaBody]=useState("");
  const [mediaImageUrl,setMediaImageUrl]=useState("");

  const [settingsName,setSettingsName]=useState("");
  const [settingsDescription,setSettingsDescription]=useState("");
  const [settingsFormat,setSettingsFormat]=useState<CompetitionFormat>("LEAGUE");
  const [settingsMaxTeams,setSettingsMaxTeams]=useState("");
  const [settingsFee,setSettingsFee]=useState("");
  const [settingsRegistrationDeadline,setSettingsRegistrationDeadline]=useState("");
  const [settingsStartsAt,setSettingsStartsAt]=useState("");
  const [settingsEndsAt,setSettingsEndsAt]=useState("");
  const [settingsDuration,setSettingsDuration]=useState("");
  const [settingsWin,setSettingsWin]=useState("");
  const [settingsDraw,setSettingsDraw]=useState("");
  const [settingsLoss,setSettingsLoss]=useState("");
  const [settingsGroupCount,setSettingsGroupCount]=useState("");
  const [settingsQualifiers,setSettingsQualifiers]=useState("");

  const [activeMatch,setActiveMatch]=useState<CompetitionMatchDto|null>(null);
  const [editMode,setEditMode]=useState<EditMode>(null);
  const [areaId,setAreaId]=useState("");
  const [startsAt,setStartsAt]=useState("");
  const [endsAt,setEndsAt]=useState("");
  const [refereeUserId,setRefereeUserId]=useState<string|null>(null);
  const [homeScore,setHomeScore]=useState("");
  const [awayScore,setAwayScore]=useState("");
  const [correctionReason,setCorrectionReason]=useState("");
  const [confirmImpact,setConfirmImpact]=useState(false);

  function syncSettings(next:CompetitionDto){
    setSettingsName(next.name);
    setSettingsDescription(next.description??"");
    setSettingsFormat(next.format);
    setSettingsMaxTeams(String(next.maxTeams));
    setSettingsFee(String(next.registrationFeeAfn));
    setSettingsRegistrationDeadline(next.registrationClosesAt??"");
    setSettingsStartsAt(next.startsAt??"");
    setSettingsEndsAt(next.endsAt??"");
    setSettingsDuration(String(next.matchDurationMinutes));
    setSettingsWin(String(next.winPoints));
    setSettingsDraw(String(next.drawPoints));
    setSettingsLoss(String(next.lossPoints));
    setSettingsGroupCount(String(next.groupCount??2));
    setSettingsQualifiers(String(next.qualifiersPerGroup??2));
  }

  const load=useCallback(async()=>{
    if(!session||!competitionId)return;
    setLoading(true);setError(null);
    try{
      const [{competition:next},status,refereeResult,teamResult,mediaResult]=await Promise.all([
        competitionApi.ownerGet(session.accessToken,competitionId),
        ownerApi.getStatus(session.accessToken),
        ownerApi.referees(session.accessToken),
        teamApi.directory(session.accessToken),
        competitionApi.ownerMedia(session.accessToken,competitionId),
      ]);
      setCompetition(next);
      syncSettings(next);
      setReferees(refereeResult.referees);
      setDirectoryTeams(teamResult.teams);
      setMediaPosts(mediaResult.posts);
      const venueAreas=status.venue?.areas.map((item)=>({id:item.id,name:item.name}))??[];
      setAreas(venueAreas);
      setAreaId((current)=>current||venueAreas[0]?.id||"");
    }catch{setError(t("competition.loadError"));}
    finally{setLoading(false);}
  },[competitionId,session,t]);

  useEffect(()=>{void load();},[load]);

  const pending=useMemo(
    ()=>competition?.teams.filter((team)=>team.status==="APPLIED"||team.status==="PENDING")??[],
    [competition],
  );
  const accepted=useMemo(
    ()=>competition?.teams.filter((team)=>team.status==="ACCEPTED")??[],
    [competition],
  );
  const matches=useMemo(()=>competition?.matches.slice().sort((a,b)=>
    a.stage.localeCompare(b.stage)||b.roundNumber-a.roundNumber||a.slotNumber-b.slotNumber
  )??[],[competition]);
  const availableTeams=useMemo(()=>{
    const represented=new Set(
      competition?.teams
        .filter((team)=>!["REJECTED","WITHDRAWN"].includes(team.status))
        .map((team)=>team.teamId)??[],
    );
    return directoryTeams.filter((team)=>!represented.has(team.id));
  },[competition?.teams,directoryTeams]);
  const completedMatches=matches.filter((match)=>match.status==="COMPLETED"||match.status==="CORRECTED");
  const paidTeams=accepted.filter((team)=>team.feeStatus==="PAID"||team.feeStatus==="WAIVED");
  const nextMatch=matches
    .filter((match)=>match.startsAt&&["SCHEDULED","IN_PROGRESS"].includes(match.status))
    .sort((a,b)=>Date.parse(a.startsAt!)-Date.parse(b.startsAt!))[0]??null;
  const knockoutMatches=matches.filter((match)=>match.stage==="KNOCKOUT");
  const unassignedMatches=matches.filter((match)=>match.homeTeamId&&match.awayTeamId&&!match.refereeUserId);
  const canManageRegistration=competition?["DRAFT","REGISTRATION_OPEN","REGISTRATION_CLOSED"].includes(competition.status):false;

  async function action(action:CompetitionStateRequest["action"]){
    if(!session||!competitionId)return;
    if(action==="OPEN_REGISTRATION"&&competition){
      if(!competition.registrationClosesAt){
        setError(t("competition.schedule.deadlineRequired"));return;
      }
      if(Date.parse(competition.registrationClosesAt)<Date.now()+THREE_DAYS_MS){
        setError(t("competition.schedule.deadlineMin"));return;
      }
      if(competition.startsAt&&Date.parse(competition.startsAt)<=Date.parse(competition.registrationClosesAt)){
        setError(t("competition.schedule.startAfterDeadline"));return;
      }
      if(competition.startsAt&&competition.endsAt&&Date.parse(competition.endsAt)<=Date.parse(competition.startsAt)){
        setError(t("competition.schedule.endAfterStart"));return;
      }
    }
    setBusy(action);setError(null);setMessage(null);
    try{
      const {competition:next}=await competitionApi.changeState(session.accessToken,competitionId,{action});
      setCompetition(next);syncSettings(next);
      setMessage(t("competition.control.saved"));
    }catch{setError(t("competition.stateError"));}
    finally{setBusy(null);}
  }

  function availableActions():CompetitionStateRequest["action"][]{
    if(!competition)return[];
    const actions:CompetitionStateRequest["action"][]=[];
    if(competition.status==="DRAFT")actions.push("OPEN_REGISTRATION","CANCEL");
    if(competition.status==="REGISTRATION_OPEN"){
      actions.push("CLOSE_REGISTRATION",competition.published?"UNPUBLISH":"PUBLISH","CANCEL");
    }
    if(competition.status==="REGISTRATION_CLOSED")actions.push("OPEN_REGISTRATION","GENERATE_FIXTURES","CANCEL");
    if((competition.status==="SCHEDULED"||competition.status==="IN_PROGRESS")&&competition.format==="GROUP_KNOCKOUT"&&!knockoutMatches.length){
      const groups=matches.filter((match)=>match.stage==="GROUP");
      if(groups.length>0&&groups.every((match)=>["COMPLETED","CORRECTED"].includes(match.status)))actions.push("GENERATE_KNOCKOUT");
    }
    if(
      (competition.status==="SCHEDULED"||competition.status==="IN_PROGRESS")
      &&matches.length>0
      &&matches.every((match)=>["COMPLETED","CORRECTED"].includes(match.status))
      &&(competition.format!=="GROUP_KNOCKOUT"||knockoutMatches.length>0)
    )actions.push("COMPLETE");
    if(competition.status==="SCHEDULED"||competition.status==="IN_PROGRESS")actions.push("CANCEL");
    if(competition.status==="COMPLETED")actions.push("ARCHIVE");
    return actions;
  }

  function actionLabel(value:CompetitionStateRequest["action"]){
    if(value==="OPEN_REGISTRATION")return t("competition.openRegistration");
    if(value==="CLOSE_REGISTRATION")return t("competition.closeRegistration");
    if(value==="GENERATE_FIXTURES")return t("competition.generateFixtures");
    if(value==="GENERATE_KNOCKOUT")return t("competition.generateKnockout");
    if(value==="COMPLETE")return t("competition.complete");
    if(value==="ARCHIVE")return t("competition.archive");
    if(value==="UNPUBLISH")return t("competition.unpublish");
    if(value==="PUBLISH")return t("competition.publish");
    return t("competition.control.cancelCompetition");
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

  async function invite(teamId:string){
    if(!session||!competitionId)return;
    setBusy(`invite:${teamId}`);setError(null);
    try{
      await competitionApi.inviteTeam(session.accessToken,competitionId,{teamId,seed:null});
      await load();
    }catch{setError(t("competition.inviteError"));}
    finally{setBusy(null);}
  }

  function beginSeed(team:CompetitionTeamDto){
    setSeedTeamId(team.teamId);
    setSeedDraft(team.seed===null?"":String(team.seed));
  }

  async function saveSeed(teamId:string){
    if(!session||!competitionId)return;
    const seed=seedDraft.trim()===""?null:Number(seedDraft);
    if(seed!==null&&(!Number.isInteger(seed)||seed<1||seed>128)){
      setError(t("competition.control.seedError"));
      return;
    }
    setBusy(`seed:${teamId}`);setError(null);
    try{
      await competitionApi.updateSeed(session.accessToken,competitionId,teamId,{seed});
      setSeedTeamId(null);setSeedDraft("");
      await load();
    }catch{setError(t("competition.control.seedError"));}
    finally{setBusy(null);}
  }

  function confirmRemoveTeam(team:CompetitionTeamDto){
    Alert.alert(
      t("competition.control.removeTeamTitle"),
      t("competition.control.removeTeamBody",{name:team.teamName}),
      [
        {text:t("common.cancel"),style:"cancel"},
        {text:t("competition.control.removeTeam"),style:"destructive",onPress:()=>void removeTeam(team.teamId)},
      ],
    );
  }

  async function removeTeam(teamId:string){
    if(!session||!competitionId)return;
    setBusy(`remove-team:${teamId}`);setError(null);
    try{
      await competitionApi.removeTeam(session.accessToken,competitionId,teamId);
      await load();
    }catch{setError(t("competition.control.removeTeamError"));}
    finally{setBusy(null);}
  }

  function beginFee(team:CompetitionTeamDto){
    setFeeTeamId(team.teamId);
    setFeeReference(team.feePaymentReference??"");
  }

  async function updateFee(teamId:string,status:CompetitionFeeStatus){
    if(!session||!competitionId)return;
    setBusy(`fee:${teamId}`);setError(null);
    try{
      await competitionApi.updateFee(session.accessToken,competitionId,teamId,{
        status,
        paymentReference:feeReference.trim(),
      });
      setFeeTeamId(null);setFeeReference("");
      await load();
    }catch{setError(t("competition.control.feeError"));}
    finally{setBusy(null);}
  }

  function openSchedule(match:CompetitionMatchDto){
    setActiveTab("FIXTURES");
    setActiveMatch(match);setEditMode("SCHEDULE");
    setAreaId(match.areaId??areas[0]?.id??"");
    setStartsAt(match.startsAt??"");
    setEndsAt(match.endsAt??"");
    setRefereeUserId(match.refereeUserId??null);
  }

  function applyDuration(){
    if(!competition||!startsAt)return;
    const start=Date.parse(startsAt);
    if(Number.isNaN(start))return;
    setEndsAt(new Date(start+competition.matchDurationMinutes*60_000).toISOString());
  }

  function openResult(match:CompetitionMatchDto){
    setActiveTab("FIXTURES");
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
      const {competition:next}=await competitionApi.scheduleMatch(session.accessToken,competitionId,activeMatch.id,{areaId,startsAt,endsAt,refereeUserId});
      setCompetition(next);syncSettings(next);setActiveMatch(null);setEditMode(null);
    }catch{setError(t("competition.scheduleError"));}
    finally{setBusy(null);}
  }

  async function saveResult(){
    if(!session||!competitionId||!activeMatch)return;
    const home=Number(homeScore),away=Number(awayScore);
    if(!Number.isInteger(home)||home<0||!Number.isInteger(away)||away<0){setError(t("competition.resultError"));return;}
    setBusy("result");setError(null);
    try{
      const trimmedReason=correctionReason.trim();
      const result=await competitionApi.enterResult(session.accessToken,competitionId,activeMatch.id,{
        homeScore:home,
        awayScore:away,
        ...(trimmedReason?{correctionReason:trimmedReason}:{}),
        confirmImpact,
        playerStats:[],
      });
      setCompetition(result.competition);syncSettings(result.competition);setActiveMatch(null);setEditMode(null);
    }catch{setError(t("competition.resultError"));}
    finally{setBusy(null);}
  }

  async function createMedia(){
    if(!session||!competitionId||!mediaBody.trim())return;
    setBusy("media-create");setError(null);
    try{
      const {post}=await competitionApi.createMediaPost(session.accessToken,competitionId,{
        body:mediaBody.trim(),
        imageUrl:mediaImageUrl.trim()||null,
      });
      setMediaPosts((current)=>[post,...current]);
      setMediaBody("");setMediaImageUrl("");
      setMessage(t("competition.control.mediaPublished"));
    }catch{setError(t("competition.control.mediaError"));}
    finally{setBusy(null);}
  }

  async function toggleMedia(post:CompetitionMediaPostDto){
    if(!session||!competitionId)return;
    setBusy(`media:${post.id}`);setError(null);
    try{
      const {post:next}=await competitionApi.setMediaStatus(session.accessToken,competitionId,post.id,{published:post.status!=="PUBLISHED"});
      setMediaPosts((current)=>current.map((item)=>item.id===next.id?next:item));
    }catch{setError(t("competition.control.mediaError"));}
    finally{setBusy(null);}
  }

  async function saveSettings(){
    if(!session||!competitionId||!competition)return;
    const maxTeams=Number(settingsMaxTeams);
    const registrationFeeAfn=Number(settingsFee);
    const matchDurationMinutes=Number(settingsDuration);
    const winPoints=Number(settingsWin),drawPoints=Number(settingsDraw),lossPoints=Number(settingsLoss);
    const groupCount=Number(settingsGroupCount),qualifiersPerGroup=Number(settingsQualifiers);
    if(
      !settingsName.trim()
      ||!Number.isInteger(maxTeams)||maxTeams<2
      ||!Number.isInteger(registrationFeeAfn)||registrationFeeAfn<0
      ||!Number.isInteger(matchDurationMinutes)||matchDurationMinutes<20||matchDurationMinutes>180
      ||![winPoints,drawPoints,lossPoints].every((value)=>Number.isInteger(value)&&value>=0&&value<=20)
    ){setError(t("competition.control.settingsError"));return;}

    const deadlineMs=settingsRegistrationDeadline?Date.parse(settingsRegistrationDeadline):null;
    const startMs=settingsStartsAt?Date.parse(settingsStartsAt):null;
    const endMs=settingsEndsAt?Date.parse(settingsEndsAt):null;
    if(
      (competition.status==="DRAFT"||competition.status==="REGISTRATION_CLOSED")
      &&deadlineMs!==null
      &&deadlineMs<Date.now()+THREE_DAYS_MS
    ){setError(t("competition.schedule.deadlineMin"));return;}
    if(deadlineMs!==null&&startMs!==null&&startMs<=deadlineMs){
      setError(t("competition.schedule.startAfterDeadline"));return;
    }
    if(startMs!==null&&endMs!==null&&endMs<=startMs){
      setError(t("competition.schedule.endAfterStart"));return;
    }

    const input:CompetitionUpdateRequest={
      name:settingsName.trim(),
      description:settingsDescription.trim(),
      format:settingsFormat,
      maxTeams,
      registrationFeeAfn,
      winPoints,drawPoints,lossPoints,
      tieBreakOrder:competition.tieBreakOrder,
      groupCount:settingsFormat==="GROUP_KNOCKOUT"?groupCount:null,
      qualifiersPerGroup:settingsFormat==="GROUP_KNOCKOUT"?qualifiersPerGroup:null,
      registrationClosesAt:settingsRegistrationDeadline.trim()||null,
      matchDurationMinutes,
      startsAt:settingsStartsAt.trim()||null,
      endsAt:settingsEndsAt.trim()||null,
    };
    setBusy("settings");setError(null);setMessage(null);
    try{
      const {competition:next}=await competitionApi.update(session.accessToken,competitionId,input);
      setCompetition(next);syncSettings(next);setMessage(t("competition.control.saved"));
    }catch{setError(t("competition.control.settingsError"));}
    finally{setBusy(null);}
  }

  async function duplicateCompetition(){
    if(!session||!competitionId)return;
    setBusy("duplicate");setError(null);
    try{
      const {competition:copy}=await competitionApi.duplicate(session.accessToken,competitionId);
      router.replace({pathname:"/owner/competitions/[competitionId]/manage",params:{competitionId:copy.id}});
    }catch{setError(t("competition.control.duplicateError"));}
    finally{setBusy(null);}
  }

  function confirmDelete(){
    Alert.alert(
      t("competition.control.deleteTitle"),
      t("competition.control.deleteBody"),
      [
        {text:t("common.cancel"),style:"cancel"},
        {text:t("competition.control.delete"),style:"destructive",onPress:()=>void removeCompetition()},
      ],
    );
  }

  async function removeCompetition(){
    if(!session||!competitionId)return;
    setBusy("delete");setError(null);
    try{
      await competitionApi.remove(session.accessToken,competitionId);
      router.replace("/owner/competitions");
    }catch{setError(t("competition.control.deleteError"));}
    finally{setBusy(null);}
  }

  if(loading)return <Screen showHeader><OwnerTopNav/><DataLoadingState variant="dashboard" minHeight={520}/></Screen>;

  return <Screen showHeader>
    <OwnerTopNav/>
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    {message?<Card style={{backgroundColor:colors.primarySoft}}><AppText style={{color:colors.primary}}>{message}</AppText></Card>:null}

    {competition?<>
      <Card style={styles.hero}>
        <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm,alignItems:"flex-start"}}>
          <View style={styles.heroIcon}><Ionicons name="trophy-outline" size={26} color={colors.primary}/></View>
          <View style={{flex:1,gap:4,alignItems:isRTL?"flex-end":"flex-start"}}>
            <AppText variant="title" weight="bold" style={{color:"#FFFFFF"}}>{competition.name}</AppText>
            <AppText style={{color:"#DCE8FF"}}>
              {t(`competition.format.${competition.format}` as never)} · {t(`competition.status.${competition.status}` as never)}
            </AppText>
            <AppText variant="caption" style={{color:"#DCE8FF"}}>
              {t("competition.acceptedTeams",{count:accepted.length,max:competition.maxTeams})}
            </AppText>
          </View>
          <View style={[styles.publicBadge,{backgroundColor:competition.published?"#DCFCE7":"#F1F5F9"}]}>
            <AppText variant="caption" weight="bold" style={{color:competition.published?colors.success:colors.textMuted}}>
              {competition.published?t("competition.control.public"):t("competition.control.private")}
            </AppText>
          </View>
        </View>
      </Card>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroller}
        contentContainerStyle={[styles.tabs,{flexDirection:isRTL?"row-reverse":"row"}]}
      >
        {tabs.map((tab)=><Pressable
          key={tab.key}
          onPress={()=>setActiveTab(tab.key)}
          style={[styles.tab,activeTab===tab.key&&styles.tabActive]}
        >
          <Ionicons name={tab.icon} size={17} color={activeTab===tab.key?colors.primary:colors.textMuted}/>
          <AppText variant="caption" weight="semibold" style={activeTab===tab.key?{color:colors.primary}:undefined}>
            {t(`competition.control.tabs.${tab.key}` as never)}
          </AppText>
        </Pressable>)}
      </ScrollView>

      {activeTab==="OVERVIEW"?<>
        <View style={styles.metricGrid}>
          <Metric icon="people-outline" value={`${accepted.length}/${competition.maxTeams}`} label={t("competition.control.teams")}/>
          <Metric icon="football-outline" value={`${completedMatches.length}/${matches.length}`} label={t("competition.control.matches")}/>
          <Metric icon="cash-outline" value={`${paidTeams.length}/${accepted.length}`} label={t("competition.control.fees")}/>
          <Metric icon="newspaper-outline" value={String(mediaPosts.filter((post)=>post.status==="PUBLISHED").length)} label={t("competition.control.media")}/>
        </View>

        <Card style={{gap:spacing.md}}>
          <AppText variant="bodyLarge" weight="bold">{t("competition.control.currentStatus")}</AppText>
          <InfoRow label={t("competition.control.status")} value={t(`competition.status.${competition.status}` as never)} rtl={isRTL}/>
          <InfoRow label={t("competition.format")} value={t(`competition.format.${competition.format}` as never)} rtl={isRTL}/>
          <InfoRow label={t("competition.matchDuration")} value={t("competition.control.minutes",{count:competition.matchDurationMinutes})} rtl={isRTL}/>
          <InfoRow label={t("competition.registrationFee")} value={`${competition.registrationFeeAfn} AFN`} rtl={isRTL}/>
          {competition.registrationClosesAt?<DateInfo label={t("competition.registrationDeadline")} value={competition.registrationClosesAt} language={language} rtl={isRTL}/>:null}
          {competition.startsAt?<DateInfo label={t("competition.startsAt")} value={competition.startsAt} language={language} rtl={isRTL}/>:null}
          {nextMatch?<View style={{gap:spacing.xs}}>
            <AppText muted>{t("competition.control.nextMatch")}</AppText>
            <AppText weight="semibold">{nextMatch.homeTeamName??t("competition.tbd")} — {nextMatch.awayTeamName??t("competition.tbd")}</AppText>
            {nextMatch.startsAt?<DateInfo label={nextMatch.areaName??t("competition.area")} value={nextMatch.startsAt} language={language} rtl={isRTL}/>:null}
          </View>:null}
          {competition.championTeamId?<InfoRow
            label={t("competition.champion")}
            value={competition.teams.find((team)=>team.teamId===competition.championTeamId)?.teamName??"—"}
            rtl={isRTL}
          />:competition.standings[0]?<InfoRow label={t("competition.control.currentLeader")} value={competition.standings[0].teamName} rtl={isRTL}/>:null}
        </Card>

        <Card style={{gap:spacing.md}}>
          <AppText variant="bodyLarge" weight="bold">{t("competition.control.lifecycle")}</AppText>
          <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm,flexWrap:"wrap"}}>
            {availableActions().map((value)=><Button
              key={value}
              label={actionLabel(value)}
              onPress={()=>void action(value)}
              loading={busy===value}
              variant={value==="CANCEL"?"ghost":"secondary"}
            />)}
          </View>
          <Button
            label={t("competition.open")}
            onPress={()=>router.push({pathname:"/competitions/[competitionId]",params:{competitionId}})}
            variant="ghost"
          />
        </Card>
      </>:null}

      {activeTab==="TEAMS"?<>
        {pending.length>0?<Card style={{gap:spacing.md}}>
          <AppText variant="bodyLarge" weight="bold">{t("competition.pendingApplications")}</AppText>
          {pending.map((team)=><View key={team.teamId} style={styles.dividedRow}>
            <View style={{flex:1}}>
              <AppText weight="bold">{team.teamName}</AppText>
              <AppText variant="caption" muted>{t(`competition.registrationStatus.${team.status}` as never)}</AppText>
            </View>
            <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.xs}}>
              <Button label={t("competition.accept")} onPress={()=>void decide(team.teamId,"ACCEPTED")} loading={busy===`registration:${team.teamId}`} style={{flex:1}}/>
              <Button label={t("competition.reject")} onPress={()=>void decide(team.teamId,"REJECTED")} variant="secondary" style={{flex:1}}/>
            </View>
          </View>)}
        </Card>:null}

        {canManageRegistration?<Card style={{gap:spacing.md}}>
          <AppText variant="bodyLarge" weight="bold">{t("competition.control.assignTeams")}</AppText>
          <AppText muted>{t("competition.control.assignTeamsBody")}</AppText>
          {availableTeams.length===0?<AppText muted>{t("competition.control.noTeamsAvailable")}</AppText>:null}
          {availableTeams.map((team)=><View key={team.id} style={[styles.dividedRow,{flexDirection:isRTL?"row-reverse":"row",alignItems:"center"}]}>
            <View style={{flex:1}}>
              <AppText weight="bold">{team.name}</AppText>
              <AppText variant="caption" muted>{team.city}</AppText>
            </View>
            <Button
              label={t("competition.inviteTeam")}
              onPress={()=>void invite(team.id)}
              loading={busy===`invite:${team.id}`}
              variant="secondary"
            />
          </View>)}
        </Card>:null}

        <View style={{gap:spacing.xs}}>
          <AppText variant="bodyLarge" weight="bold">{t("competition.control.registeredTeams")}</AppText>
          <AppText muted>{t("competition.control.registeredTeamsBody")}</AppText>
        </View>

        {competition.teams.map((team)=><Card key={team.teamId} style={{gap:spacing.sm}}>
          <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
            {team.logoUrl?<Image source={{uri:team.logoUrl}} style={styles.teamLogo}/>:<View style={styles.teamLogoFallback}><AppText weight="bold" style={{color:colors.primary}}>{team.teamName.slice(0,2).toUpperCase()}</AppText></View>}
            <View style={{flex:1,alignItems:isRTL?"flex-end":"flex-start"}}>
              <AppText weight="bold">{team.teamName}</AppText>
              <AppText variant="caption" muted>{t(`competition.registrationStatus.${team.status}` as never)}{team.groupName?` · ${t("competition.group",{name:team.groupName})}`:""}</AppText>
            </View>
            {team.status==="ACCEPTED"?<View style={styles.feeBadge}>
              <AppText variant="caption" weight="bold" style={{color:colors.primary}}>{t(`competition.feeStatus.${team.feeStatus}` as never)}</AppText>
            </View>:null}
          </View>

          {team.status==="ACCEPTED"?<>
            <View style={{flexDirection:isRTL?"row-reverse":"row",justifyContent:"space-between",gap:spacing.sm}}>
              <AppText variant="caption" muted>{t("competition.registrationFee")}: {competition.registrationFeeAfn} AFN</AppText>
              <AppText variant="caption" muted>{t("competition.seed")}: {team.seed??"—"}</AppText>
            </View>
            {team.feePaymentReference?<AppText variant="caption" muted>{t("competition.control.paymentReference")}: {team.feePaymentReference}</AppText>:null}

            {canManageRegistration?<View style={{gap:spacing.sm}}>
              {seedTeamId===team.teamId?<View style={{gap:spacing.sm}}>
                <TextField
                  label={t("competition.seed")}
                  value={seedDraft}
                  onChangeText={setSeedDraft}
                  keyboardType="number-pad"
                  forceLtr
                  placeholder={t("competition.control.seedPlaceholder")}
                />
                <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
                  <Button
                    label={t("common.save")}
                    onPress={()=>void saveSeed(team.teamId)}
                    loading={busy===`seed:${team.teamId}`}
                    style={{flex:1}}
                  />
                  <Button
                    label={t("common.cancel")}
                    onPress={()=>{setSeedTeamId(null);setSeedDraft("");}}
                    variant="secondary"
                    style={{flex:1}}
                  />
                </View>
              </View>:<View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
                <Button label={t("competition.control.editSeed")} onPress={()=>beginSeed(team)} variant="secondary" style={{flex:1}}/>
                <Button
                  label={t("competition.control.removeTeam")}
                  onPress={()=>confirmRemoveTeam(team)}
                  loading={busy===`remove-team:${team.teamId}`}
                  variant="ghost"
                  style={{flex:1}}
                />
              </View>}
            </View>:null}

            {feeTeamId===team.teamId?<View style={{gap:spacing.sm}}>
              <TextField label={t("competition.control.paymentReference")} value={feeReference} onChangeText={setFeeReference}/>
              <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.xs,flexWrap:"wrap"}}>
                {feeStatuses.map((status)=><Pressable
                  key={status}
                  onPress={()=>void updateFee(team.teamId,status)}
                  style={[styles.choice,team.feeStatus===status&&styles.choiceActive]}
                >
                  <AppText variant="caption" weight="semibold">{t(`competition.feeStatus.${status}` as never)}</AppText>
                </Pressable>)}
              </View>
              <Button label={t("common.cancel")} onPress={()=>{setFeeTeamId(null);setFeeReference("");}} variant="ghost"/>
            </View>:<Button label={t("competition.control.manageFee")} onPress={()=>beginFee(team)} variant="secondary"/>}
          </>:null}
        </Card>)}
      </>:null}

      {activeTab==="FIXTURES"?<>
        <View style={{gap:spacing.xs}}>
          <AppText variant="bodyLarge" weight="bold">{t("competition.fixtures")}</AppText>
          <AppText muted>{t("competition.control.fixturesBody")}</AppText>
        </View>

        {matches.length===0?<Card><AppText muted>{t("competition.noFixtures")}</AppText></Card>:null}
        {matches.map((match)=>{
          const when=match.startsAt?formatLocalDateTimeParts(match.startsAt,language):null;
          return <Card key={match.id} style={{gap:spacing.sm}}>
            <View style={{flexDirection:isRTL?"row-reverse":"row",justifyContent:"space-between",gap:spacing.sm}}>
              <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
                {match.groupName?t("competition.group",{name:match.groupName}):t("competition.round",{number:match.roundNumber})}
              </AppText>
              <AppText variant="caption" muted>{t(`competition.matchStatus.${match.status}` as never)}</AppText>
            </View>
            <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
              <AppText weight="bold" style={{flex:1}}>{match.homeTeamName??t("competition.tbd")}</AppText>
              <AppText variant="bodyLarge" weight="bold" forceLtr>{match.homeScore===null||match.awayScore===null?"—":`${match.homeScore} - ${match.awayScore}`}</AppText>
              <AppText weight="bold" style={{flex:1,textAlign:isRTL?"left":"right"}}>{match.awayTeamName??t("competition.tbd")}</AppText>
            </View>
            {when?<AppText variant="caption" muted>{when.date} · {when.time}{match.areaName?` · ${match.areaName}`:""}</AppText>:null}
            <AppText variant="caption" muted>
              {match.refereeUserId
                ?t("competition.control.refereeAssigned",{name:referees.find((item)=>item.userId===match.refereeUserId)?.displayName??"—"})
                :t("competition.control.refereeUnassigned")}
            </AppText>
            {match.homeTeamId&&match.awayTeamId?<View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
              <Button label={t("competition.scheduleMatch")} onPress={()=>openSchedule(match)} variant="secondary" style={{flex:1}}/>
              <Button label={t("competition.enterResult")} onPress={()=>openResult(match)} variant="secondary" style={{flex:1}}/>
            </View>:null}
          </Card>;
        })}

        {activeMatch&&editMode==="SCHEDULE"?<Card style={styles.editorCard}>
          <AppText variant="bodyLarge" weight="bold">{t("competition.scheduleMatch")}</AppText>
          <AppText>{activeMatch.homeTeamName??t("competition.tbd")} — {activeMatch.awayTeamName??t("competition.tbd")}</AppText>
          <AppText weight="semibold">{t("competition.area")}</AppText>
          <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm,flexWrap:"wrap"}}>
            {areas.map((area)=><Pressable key={area.id} onPress={()=>setAreaId(area.id)} style={[styles.choice,areaId===area.id&&styles.choiceActive]}>
              <AppText>{area.name}</AppText>
            </Pressable>)}
          </View>
          <DateTimePickerField label={t("competition.startsAt")} value={startsAt} onChange={setStartsAt}/>
          <DateTimePickerField
            label={t("competition.endsAt")}
            value={endsAt}
            onChange={setEndsAt}
            minimumDate={startsAt?after(startsAt,60_000):undefined}
            hint={t("competition.schedule.endAfterStart")}
          />
          <Button label={t("competition.control.useDuration")} onPress={applyDuration} variant="ghost"/>
          <AppText weight="semibold">{t("competition.referee")}</AppText>
          <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm,flexWrap:"wrap"}}>
            <Pressable onPress={()=>setRefereeUserId(null)} style={[styles.choice,refereeUserId===null&&styles.choiceActive]}>
              <AppText>{t("competition.noReferee")}</AppText>
            </Pressable>
            {referees.map((referee)=><Pressable key={referee.userId} onPress={()=>setRefereeUserId(referee.userId)} style={[styles.choice,refereeUserId===referee.userId&&styles.choiceActive]}>
              <AppText>{referee.displayName}</AppText>
            </Pressable>)}
          </View>
          <Button label={t("common.save")} onPress={()=>void saveSchedule()} loading={busy==="schedule"}/>
          <Button label={t("common.cancel")} onPress={()=>{setActiveMatch(null);setEditMode(null);}} variant="secondary"/>
        </Card>:null}

        {activeMatch&&editMode==="RESULT"?<Card style={styles.editorCard}>
          <AppText variant="bodyLarge" weight="bold">{t("competition.enterResult")}</AppText>
          <AppText>{activeMatch.homeTeamName??t("competition.tbd")} — {activeMatch.awayTeamName??t("competition.tbd")}</AppText>
          <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
            <TextField label={t("competition.homeScore")} value={homeScore} onChangeText={setHomeScore} keyboardType="number-pad" forceLtr containerStyle={{flex:1}}/>
            <TextField label={t("competition.awayScore")} value={awayScore} onChangeText={setAwayScore} keyboardType="number-pad" forceLtr containerStyle={{flex:1}}/>
          </View>
          {(activeMatch.status==="COMPLETED"||activeMatch.status==="CORRECTED")?<>
            <TextField label={t("competition.correctionReason")} value={correctionReason} onChangeText={setCorrectionReason}/>
            <Pressable onPress={()=>setConfirmImpact((value)=>!value)} style={[styles.choice,confirmImpact&&styles.choiceActive]}>
              <AppText weight="semibold">{confirmImpact?"✓ ":""}{t("competition.confirmImpact")}</AppText>
            </Pressable>
          </>:null}
          <Button label={t("common.save")} onPress={()=>void saveResult()} loading={busy==="result"}/>
          <Button label={t("common.cancel")} onPress={()=>{setActiveMatch(null);setEditMode(null);}} variant="secondary"/>
        </Card>:null}
      </>:null}

      {activeTab==="STANDINGS"?<>
        {competition.standings.length>0?<View style={{gap:spacing.sm}}>
          <AppText variant="bodyLarge" weight="bold">{t("competition.standings")}</AppText>
          {competition.standings.map((row)=><Card key={`${row.groupId??"league"}:${row.teamId}`} style={{gap:spacing.xs}}>
            <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
              <View style={styles.position}><AppText weight="bold">{row.position}</AppText></View>
              <View style={{flex:1}}>
                <AppText weight="bold">{row.teamName}</AppText>
                {row.groupName?<AppText variant="caption" muted>{t("competition.group",{name:row.groupName})}</AppText>:null}
              </View>
              <AppText weight="bold" style={{color:colors.primary}}>{row.points} pts</AppText>
            </View>
            <AppText variant="caption" muted forceLtr>
              P {row.played} · W {row.wins} · D {row.draws} · L {row.losses} · GF {row.goalsFor} · GA {row.goalsAgainst} · GD {row.goalDifference}
            </AppText>
          </Card>)}
        </View>:null}

        {(competition.format==="KNOCKOUT"||competition.format==="GROUP_KNOCKOUT")?<View style={{gap:spacing.sm}}>
          <AppText variant="bodyLarge" weight="bold">{t("competition.bracket")}</AppText>
          {knockoutMatches.length===0?<Card><AppText muted>{t("competition.control.bracketPending")}</AppText></Card>:null}
          {knockoutMatches.slice().sort((a,b)=>b.roundNumber-a.roundNumber||a.slotNumber-b.slotNumber).map((match)=><Card key={match.id}>
            <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>{t("competition.round",{number:match.roundNumber})}</AppText>
            <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
              <AppText weight="bold" style={{flex:1}}>{match.homeTeamName??t("competition.tbd")}</AppText>
              <AppText weight="bold" forceLtr>{match.homeScore===null||match.awayScore===null?"—":`${match.homeScore} - ${match.awayScore}`}</AppText>
              <AppText weight="bold" style={{flex:1,textAlign:isRTL?"left":"right"}}>{match.awayTeamName??t("competition.tbd")}</AppText>
            </View>
          </Card>)}
        </View>:null}
      </>:null}

      {activeTab==="REFEREES"?<>
        <View style={styles.metricGrid}>
          <Metric icon="flag-outline" value={String(referees.length)} label={t("competition.control.referees")}/>
          <Metric icon="alert-circle-outline" value={String(unassignedMatches.length)} label={t("competition.control.unassigned")}/>
        </View>
        {referees.length===0?<Card><AppText muted>{t("competition.control.noReferees")}</AppText></Card>:null}
        {referees.map((referee)=>{
          const assigned=matches.filter((match)=>match.refereeUserId===referee.userId);
          return <Card key={referee.userId} style={{gap:spacing.sm}}>
            <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
              <View style={styles.refereeIcon}><Ionicons name="flag-outline" size={20} color={colors.primary}/></View>
              <View style={{flex:1}}>
                <AppText weight="bold">{referee.displayName}</AppText>
                <AppText variant="caption" muted>{t("competition.control.assignedMatches",{count:assigned.length})}</AppText>
              </View>
            </View>
            {assigned.slice(0,3).map((match)=><AppText key={match.id} variant="caption" muted>
              {match.homeTeamName??t("competition.tbd")} — {match.awayTeamName??t("competition.tbd")}
            </AppText>)}
          </Card>;
        })}
        {unassignedMatches.length>0?<Button label={t("competition.control.assignInFixtures")} onPress={()=>setActiveTab("FIXTURES")}/>:null}
      </>:null}

      {activeTab==="STATISTICS"?<>
        <View style={{gap:spacing.xs}}>
          <AppText variant="bodyLarge" weight="bold">{t("competition.stats")}</AppText>
          <AppText muted>{t("competition.control.statisticsBody")}</AppText>
        </View>
        {competition.playerStats.length===0?<Card><AppText muted>{t("competition.control.noStatistics")}</AppText></Card>:null}
        {competition.playerStats.slice().sort((a,b)=>b.goals-a.goals||b.assists-a.assists).map((stat,index)=><Card key={stat.playerUserId}>
          <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.sm}}>
            <View style={styles.position}><AppText weight="bold">{index+1}</AppText></View>
            <View style={{flex:1}}>
              <AppText weight="bold">{stat.publicDisplayName}</AppText>
              <AppText variant="caption" muted>{stat.teamName}</AppText>
            </View>
            <View style={{alignItems:isRTL?"flex-start":"flex-end"}}>
              <AppText weight="bold">{stat.goals} {t("competition.control.goals")}</AppText>
              <AppText variant="caption" muted>{stat.assists} {t("competition.control.assists")} · {stat.appearances} {t("competition.control.appearances")}</AppText>
            </View>
          </View>
          <AppText variant="caption" muted>
            {t("competition.control.cards",{yellow:stat.yellowCards,red:stat.redCards})} · {t("competition.control.cleanSheets",{count:stat.cleanSheets})}
          </AppText>
        </Card>)}
      </>:null}

      {activeTab==="MEDIA"?<>
        <Card style={{gap:spacing.md}}>
          <AppText variant="bodyLarge" weight="bold">{t("competition.control.publishUpdate")}</AppText>
          <AppText muted>{t("competition.control.mediaBody")}</AppText>
          <TextField label={t("competition.control.postBody")} value={mediaBody} onChangeText={setMediaBody} multiline/>
          <TextField label={t("competition.control.imageUrl")} value={mediaImageUrl} onChangeText={setMediaImageUrl} autoCapitalize="none" forceLtr/>
          <Button label={t("competition.control.publish")} onPress={()=>void createMedia()} loading={busy==="media-create"} disabled={!mediaBody.trim()}/>
        </Card>

        {mediaPosts.length===0?<Card><AppText muted>{t("competition.control.noMedia")}</AppText></Card>:null}
        {mediaPosts.map((post)=><Card key={post.id} style={{gap:spacing.sm}}>
          <View style={{flexDirection:isRTL?"row-reverse":"row",justifyContent:"space-between",gap:spacing.sm}}>
            <AppText variant="caption" weight="semibold" style={{color:post.status==="PUBLISHED"?colors.success:colors.textMuted}}>
              {t(`competition.control.mediaStatus.${post.status}` as never)}
            </AppText>
            <AppText variant="caption" muted>{formatLocalDateTimeParts(post.publishedAt,language).date}</AppText>
          </View>
          <AppText>{post.body}</AppText>
          {post.imageUrl?<Image source={{uri:post.imageUrl}} style={styles.mediaImage} resizeMode="cover"/>:null}
          <Button
            label={post.status==="PUBLISHED"?t("competition.unpublish"):t("competition.publish")}
            onPress={()=>void toggleMedia(post)}
            loading={busy===`media:${post.id}`}
            variant="secondary"
          />
        </Card>)}
      </>:null}

      {activeTab==="SETTINGS"?<>
        <Card style={{gap:spacing.md}}>
          <AppText variant="bodyLarge" weight="bold">{t("competition.control.settings")}</AppText>
          <TextField label={t("competition.name")} value={settingsName} onChangeText={setSettingsName}/>
          <TextField label={t("competition.description")} value={settingsDescription} onChangeText={setSettingsDescription} multiline/>

          <AppText weight="semibold">{t("competition.format")}</AppText>
          <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm,flexWrap:"wrap"}}>
            {formats.map((format)=><Pressable key={format} onPress={()=>setSettingsFormat(format)} style={[styles.choice,settingsFormat===format&&styles.choiceActive]}>
              <AppText weight="semibold">{t(`competition.format.${format}` as never)}</AppText>
            </Pressable>)}
          </View>

          <TextField label={t("competition.maxTeams")} value={settingsMaxTeams} onChangeText={setSettingsMaxTeams} keyboardType="number-pad" forceLtr/>
          <TextField label={t("competition.registrationFee")} value={settingsFee} onChangeText={setSettingsFee} keyboardType="number-pad" forceLtr/>
          <DateTimePickerField
            label={t("competition.registrationDeadline")}
            value={settingsRegistrationDeadline}
            onChange={setSettingsRegistrationDeadline}
            minimumDate={competition.status==="REGISTRATION_OPEN"?undefined:new Date(Date.now()+THREE_DAYS_MS)}
            hint={t("competition.schedule.deadlineMin")}
          />
          <DateTimePickerField
            label={t("competition.startsAt")}
            value={settingsStartsAt}
            onChange={setSettingsStartsAt}
            minimumDate={settingsRegistrationDeadline?after(settingsRegistrationDeadline,60_000):undefined}
            hint={t("competition.schedule.startAfterDeadline")}
          />
          <DateTimePickerField
            label={t("competition.endsAt")}
            value={settingsEndsAt}
            onChange={setSettingsEndsAt}
            minimumDate={settingsStartsAt?after(settingsStartsAt,60_000):undefined}
            hint={t("competition.schedule.endAfterStart")}
          />
          <TextField label={t("competition.matchDuration")} value={settingsDuration} onChangeText={setSettingsDuration} keyboardType="number-pad" forceLtr/>

          <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
            <TextField label={t("competition.winPoints")} value={settingsWin} onChangeText={setSettingsWin} keyboardType="number-pad" forceLtr containerStyle={{flex:1}}/>
            <TextField label={t("competition.drawPoints")} value={settingsDraw} onChangeText={setSettingsDraw} keyboardType="number-pad" forceLtr containerStyle={{flex:1}}/>
            <TextField label={t("competition.lossPoints")} value={settingsLoss} onChangeText={setSettingsLoss} keyboardType="number-pad" forceLtr containerStyle={{flex:1}}/>
          </View>

          {settingsFormat==="GROUP_KNOCKOUT"?<>
            <TextField label={t("competition.groupCount")} value={settingsGroupCount} onChangeText={setSettingsGroupCount} keyboardType="number-pad" forceLtr/>
            <TextField label={t("competition.qualifiersPerGroup")} value={settingsQualifiers} onChangeText={setSettingsQualifiers} keyboardType="number-pad" forceLtr/>
          </>:null}

          <Button label={t("common.save")} onPress={()=>void saveSettings()} loading={busy==="settings"}/>
        </Card>

        <Card style={{gap:spacing.md}}>
          <AppText variant="bodyLarge" weight="bold">{t("competition.control.duplicateTitle")}</AppText>
          <AppText muted>{t("competition.control.duplicateBody")}</AppText>
          <Button
            label={t("competition.control.duplicate")}
            onPress={()=>void duplicateCompetition()}
            loading={busy==="duplicate"}
            variant="secondary"
          />
        </Card>

        <Card style={{gap:spacing.md,borderColor:colors.danger}}>
          <AppText variant="bodyLarge" weight="bold" style={{color:colors.danger}}>{t("competition.control.dangerZone")}</AppText>
          <AppText muted>{t("competition.control.dangerBody")}</AppText>
          {(competition.status==="DRAFT"||competition.status==="CANCELLED")?<Button
            label={t("competition.control.delete")}
            onPress={confirmDelete}
            loading={busy==="delete"}
            variant="secondary"
          />:<AppText variant="caption" muted>{t("competition.control.deleteUnavailable")}</AppText>}
        </Card>
      </>:null}
    </>:null}
  </Screen>;
}

function Metric({icon,value,label}:{icon:keyof typeof Ionicons.glyphMap;value:string;label:string}){
  return <Card style={styles.metric}>
    <Ionicons name={icon} size={20} color={colors.primary}/>
    <AppText variant="bodyLarge" weight="bold" style={{textAlign:"center"}}>{value}</AppText>
    <AppText variant="caption" muted style={{textAlign:"center"}}>{label}</AppText>
  </Card>;
}

function InfoRow({label,value,rtl}:{label:string;value:string;rtl:boolean}){
  return <View style={{flexDirection:rtl?"row-reverse":"row",justifyContent:"space-between",gap:spacing.md}}>
    <AppText muted>{label}</AppText>
    <AppText weight="semibold">{value}</AppText>
  </View>;
}

function DateInfo({
  label,value,language,rtl,
}:{
  label:string;
  value:string;
  language:Parameters<typeof formatLocalDateTimeParts>[1];
  rtl:boolean;
}){
  const formatted=formatLocalDateTimeParts(value,language);
  return <View style={{flexDirection:rtl?"row-reverse":"row",justifyContent:"space-between",gap:spacing.md}}>
    <AppText muted>{label}</AppText>
    <View style={{alignItems:rtl?"flex-start":"flex-end"}}>
      <AppText weight="semibold">{formatted.date}</AppText>
      <AppText variant="caption" muted>{formatted.time}</AppText>
    </View>
  </View>;
}

const styles=StyleSheet.create({
  hero:{backgroundColor:colors.primary,gap:spacing.md},
  heroIcon:{width:48,height:48,borderRadius:16,alignItems:"center",justifyContent:"center",backgroundColor:"#FFFFFF"},
  publicBadge:{paddingHorizontal:spacing.sm,paddingVertical:4,borderRadius:radius.pill},
  tabScroller:{
    flexGrow:0,
    flexShrink:0,
  },
  tabs:{
    gap:spacing.sm,
    paddingVertical:spacing.xs,
    borderTopWidth:1,
    borderBottomWidth:1,
    borderColor:colors.border,
    alignItems:"center",
  },
  tab:{
    height:42,
    alignSelf:"flex-start",
    paddingHorizontal:spacing.md,
    borderRadius:radius.pill,
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"center",
    gap:spacing.xs,
  },
  tabActive:{backgroundColor:colors.primarySoft},
  metricGrid:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  metric:{width:"47%",minWidth:130,alignItems:"center",gap:spacing.xs,padding:spacing.md},
  dividedRow:{gap:spacing.sm,paddingTop:spacing.sm,borderTopWidth:1,borderTopColor:colors.border},
  teamLogo:{width:46,height:46,borderRadius:23},
  teamLogoFallback:{width:46,height:46,borderRadius:23,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  feeBadge:{paddingHorizontal:spacing.sm,paddingVertical:4,borderRadius:radius.pill,backgroundColor:colors.primarySoft},
  choice:{
    paddingHorizontal:spacing.md,
    paddingVertical:spacing.sm,
    borderRadius:radius.pill,
    borderWidth:1,
    borderColor:colors.border,
    backgroundColor:colors.surface,
  },
  choiceActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  editorCard:{gap:spacing.md,borderWidth:2,borderColor:colors.primary},
  position:{width:34,height:34,borderRadius:17,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  refereeIcon:{width:42,height:42,borderRadius:21,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  mediaImage:{width:"100%",height:220,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
});
