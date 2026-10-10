import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {BookingDto,TeamListItemDto} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useMemo,useState} from "react";
import {Pressable,ScrollView,StyleSheet,View} from "react-native";
import {ApiRequestError,bookingApi,playerActivityApi,teamOperationsApi,
  type PlayerActivities,type PlayerTeamEvent,type TeamAvailability} from "../../lib/api";
import {formatCompetitionDateTime} from "../../lib/date-time";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";

export type PlayerActivityTab="competitions"|"matches"|"schedule"|"bookings";
type ViewMode="DAY"|"WEEK"|"MONTH";
type ScheduleItem={key:string;kind:"MATCH"|"TRAINING"|"MEETING"|"FRIENDLY"|"OTHER"|"BOOKING";
  title:string;subtitle:string;startsAt:string;endsAt:string|null;teamId:string|null;
  matchId:string|null;competitionId:string|null;activityId:string|null;bookingId:string|null};
function kabulDay(value:string){
  const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kabul",day:"2-digit",month:"2-digit",year:"numeric"}).formatToParts(new Date(value));
  const get=(name:string)=>p.find(x=>x.type===name)?.value??"00";
  return get("year")+"-"+get("month")+"-"+get("day");
}
function shiftDay(day:string,days:number){
  const current=new Date(day+"T12:00:00Z");current.setUTCDate(current.getUTCDate()+days);
  return current.toISOString().slice(0,10);
}
export function inCalendarPeriod(day:string,cursor:string,view:ViewMode){
  if(view==="DAY")return day===cursor;
  if(view==="MONTH")return day.slice(0,7)===cursor.slice(0,7);
  const week=new Date(cursor+"T12:00:00Z").getUTCDay();
  const monday=shiftDay(cursor,-((week+6)%7));
  return day>=monday&&day<=shiftDay(monday,6);
}
export function actualScheduleConflicts(events:ScheduleItem[]){
  const sorted=events.filter(x=>x.endsAt&&Date.parse(x.endsAt)>Date.parse(x.startsAt))
    .sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
  const conflictIds=new Set<string>();
  for(let i=0;i<sorted.length;i++){
    for(let j=i+1;j<sorted.length;j++){
      if(Date.parse(sorted[j]!.startsAt)>=Date.parse(sorted[i]!.endsAt!))break;
      conflictIds.add(sorted[i]!.key);conflictIds.add(sorted[j]!.key);
    }
  }
  return conflictIds;
}
function Options({values,selected,onChange}:{values:{id:string;label:string}[];selected:string;onChange:(id:string)=>void}){
  return <ScrollView horizontal showsHorizontalScrollIndicator={false}
    contentContainerStyle={{flexDirection:"row",gap:spacing.sm,paddingVertical:spacing.xs}}>
    {values.map(item=><Pressable key={item.id} onPress={()=>onChange(item.id)}
      accessibilityRole="button" accessibilityState={{selected:item.id===selected}}
      style={[styles.filter,selected===item.id&&styles.filterActive]}>
      <AppText variant="caption" weight="semibold"
        style={selected===item.id?{color:colors.primary}:undefined}>{item.label}</AppText>
    </Pressable>)}
  </ScrollView>;
}
const isFinished=(status:string)=>status==="COMPLETED"||status==="CORRECTED";
export function PlayerActivityTabs({tab,token,teams}:{tab:PlayerActivityTab;token:string;teams:TeamListItemDto[]}){
  const {t,language,isRTL}=useLocale();
  const tr=(key:string)=>t(`pd2.${key}` as never);
  const date=(value:string|null)=>value?formatCompetitionDateTime(value,language):tr("notScheduled");
  const [data,setData]=useState<PlayerActivities|null>(null);
  const [bookings,setBookings]=useState<BookingDto[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null),[success,setSuccess]=useState<string|null>(null);
  const [reload,setReload]=useState(0);
  const [teamFilter,setTeamFilter]=useState("ALL");
  const [competitionFilter,setCompetitionFilter]=useState("ALL");
  const [matchFilter,setMatchFilter]=useState("UPCOMING");
  const [bookingFilter,setBookingFilter]=useState("UPCOMING");
  const [view,setView]=useState<ViewMode>("WEEK");
  const [cursor,setCursor]=useState(()=>kabulDay(new Date().toISOString()));
  const [confirmCancel,setConfirmCancel]=useState<string|null>(null);

  useFocusEffect(useCallback(()=>{
    let active=true;
    setLoading(true);setError(null);
    void Promise.all([playerActivityApi.list(token),bookingApi.mine(token)])
      .then(([items,result])=>{if(active){setData(items);setBookings(result.bookings);}})
      .catch(e=>{if(active){setError(e instanceof ApiRequestError?e.message:t("pd2.loadError"));setData(null);}})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[token,reload,t]));

  const filtered=(id:string)=>teamFilter==="ALL"||teamFilter===id;
  const registrations=(data?.competitions??[]).filter(c=>filtered(c.teamId)&&
    (competitionFilter==="ALL"||
      (competitionFilter==="UPCOMING"&&["REGISTRATION_OPEN","REGISTRATION_CLOSED","SCHEDULED"].includes(c.status))||
      (competitionFilter==="IN_PROGRESS"&&c.status==="IN_PROGRESS")||
      (competitionFilter==="COMPLETED"&&c.status==="COMPLETED")||
      (competitionFilter==="HISTORY"&&["COMPLETED","ARCHIVED"].includes(c.status))));
  const allMatches=useMemo(()=>(data?.matches??[]).filter(m=>filtered(m.teamId))
    .sort((a,b)=>(Date.parse(a.startsAt??"")||0)-(Date.parse(b.startsAt??"")||0)),
    [data,teamFilter]);
  const friendlies=(data?.friendlies??[]).filter(x=>filtered(x.teamId));
  const now=Date.now();
  const shownMatches=allMatches.filter(m=>
    matchFilter==="ALL"||
    (matchFilter==="UPCOMING"&&m.startsAt&&Date.parse(m.startsAt)>=now&&
      !isFinished(m.status)&&m.status!=="CANCELLED")||
    (matchFilter==="LIVE"&&m.status==="IN_PROGRESS")||
    (matchFilter==="COMPLETED"&&isFinished(m.status)));
  const shownBookings=bookings.filter(b=>bookingFilter==="ALL"||
    (bookingFilter==="UPCOMING"&&b.status!=="CANCELLED"&&Date.parse(b.endsAt)>now)||
    (bookingFilter==="COMPLETED"&&b.status!=="CANCELLED"&&Date.parse(b.endsAt)<=now)||
    (bookingFilter==="CANCELLED"&&b.status==="CANCELLED"));
  const events:ScheduleItem[]=useMemo(()=>[
    ...(data?.matches??[]).filter(m=>m.startsAt&&m.status!=="CANCELLED"&&filtered(m.teamId))
      .map(m=>({key:"match:"+m.id+":"+m.teamId,kind:"MATCH" as const,
        title:m.teamName+" · "+m.opponentName,subtitle:m.competitionName,
        startsAt:m.startsAt!,endsAt:m.endsAt,teamId:m.teamId,
        matchId:m.id,competitionId:m.competitionId,activityId:null,bookingId:null})),
    ...(data?.activities??[]).filter(a=>filtered(a.teamId)).map(a=>({
      key:"activity:"+a.id,kind:a.kind as ScheduleItem["kind"],title:a.title,
      subtitle:a.teamName,startsAt:a.startsAt,endsAt:a.endsAt,teamId:a.teamId,
      matchId:null,competitionId:null,activityId:a.id,bookingId:null,
    })),
    ...(data?.friendlies??[]).filter(f=>filtered(f.teamId)).map(f=>({
      key:"friendly:"+f.id+":"+f.teamId,kind:"FRIENDLY" as const,
      title:f.teamName+" · "+f.opponentName,
      subtitle:f.venueName??tr("venueNotBooked"),startsAt:f.proposedAt,endsAt:null,
      teamId:f.teamId,matchId:null,competitionId:null,activityId:null,bookingId:null,
    })),
    ...bookings.filter(b=>b.status!=="CANCELLED").map(b=>({
      key:"booking:"+b.id,kind:"BOOKING" as const,title:b.venueName,
      subtitle:b.areaName,startsAt:b.startsAt,endsAt:b.endsAt,
      teamId:null,matchId:null,competitionId:null,activityId:null,bookingId:b.id,
    })),
  ],[data,bookings,teamFilter,language]);
  const conflicts=useMemo(()=>actualScheduleConflicts(events),[events]);
  const visibleEvents=events.filter(a=>inCalendarPeriod(kabulDay(a.startsAt),cursor,view))
    .sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
  const activityById=new Map((data?.activities??[]).map(x=>[x.id,x]));
  const moved=(direction:number)=>{
    const change=view==="DAY"?1:view==="WEEK"?7:30;
    if(view==="MONTH"){
      const d=new Date(cursor+"T12:00:00Z");d.setUTCMonth(d.getUTCMonth()+direction);
      setCursor(d.toISOString().slice(0,10));
    }else setCursor(shiftDay(cursor,change*direction));
  };
  async function action(key:string,fn:()=>Promise<unknown>,after?:()=>void){
    if(busy)return;
    setBusy(key);setError(null);setSuccess(null);
    try{await fn();after?.();setSuccess(t("pd2.updated"));setReload(v=>v+1);}
    catch(e){setError(e instanceof ApiRequestError?e.message:t("pd2.actionFailed"));}
    finally{setBusy(null);}
  }
  const rsvp=(activity:PlayerTeamEvent,availability:TeamAvailability)=>
    action(activity.id,()=>teamOperationsApi.rsvp(token,activity.teamId,activity.id,availability));
  const teamOptions=[{id:"ALL",label:tr("allTeams")},...teams.map(x=>({id:x.id,label:x.name}))];
  return <View style={{gap:spacing.md}}>
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} variant="secondary" onPress={()=>setReload(x=>x+1)}/></Card>:null}
    {success?<Card style={{backgroundColor:colors.primarySoft}}><AppText style={{color:colors.primary}}>{success}</AppText></Card>:null}
    {loading?<DataLoadingState variant="list" minHeight={340}/>:data?<>
      {tab!=="bookings"?<Options values={teamOptions} selected={teamFilter} onChange={setTeamFilter}/>:null}

      {tab==="competitions"?<>
        <Options selected={competitionFilter} onChange={setCompetitionFilter}
          values={["ALL","UPCOMING","IN_PROGRESS","COMPLETED","HISTORY"].map(id=>({id,label:tr("competition."+id)}))}/>
        <Card><AppText variant="bodyLarge" weight="bold">{tr("myCompetitions")}</AppText>
          {!registrations.length?<AppText muted>{tr("noCompetitions")}</AppText>:null}
          {registrations.map(c=><View style={styles.item} key={c.id+":"+c.teamId}>
            <AppText weight="semibold">{c.name}</AppText>
            <AppText variant="caption" muted>{c.teamName} · {c.venueName}</AppText>
            <AppText variant="caption" muted>{tr("starts")}: {date(c.startsAt)}</AppText>
            <View style={styles.rows}>
              <AppText variant="caption" style={styles.chip}>{tr("competitionStatus."+c.status)}</AppText>
              <AppText variant="caption" style={styles.chip}>{tr("registrationStatus."+c.registrationStatus)}</AppText>
            </View>
            <AppText variant="caption" muted>{c.registrationStatus==="ACCEPTED"?
              c.inRoster?tr("rosterConfirmed"):tr("rosterNotSelected"):tr("rosterAwaitingRegistration")}</AppText>
            <Button variant="secondary" label={tr("competitionDetails")} onPress={()=>router.push({
              pathname:"/competitions/[competitionId]",params:{competitionId:c.id},
            })}/>
          </View>)}
        </Card>
      </>:null}

      {tab==="matches"?<>
        <Options selected={matchFilter} onChange={setMatchFilter}
          values={["UPCOMING","LIVE","COMPLETED","FRIENDLIES","ALL"].map(id=>({id,label:tr("match."+id)}))}/>
        {matchFilter==="FRIENDLIES"?<Card>
          <AppText variant="bodyLarge" weight="bold">{tr("friendlyAgreements")}</AppText>
          <AppText variant="caption" muted>{tr("friendlyDisclaimer")}</AppText>
          {!friendlies.length?<AppText muted>{tr("noMatches")}</AppText>:null}
          {friendlies.map(f=><View style={styles.item} key={f.id+":"+f.teamId}>
            <AppText weight="semibold">{f.teamName} · {f.opponentName}</AppText>
            <AppText variant="caption" muted>{date(f.proposedAt)}</AppText>
            <AppText variant="caption" muted>{f.venueName??tr("venueNotBooked")}</AppText>
          </View>)}
        </Card>:<Card>
          <AppText variant="bodyLarge" weight="bold">{tr("officialMatches")}</AppText>
          {!shownMatches.length?<AppText muted>{tr("noMatches")}</AppText>:null}
          {shownMatches.map(m=><View style={styles.item} key={m.id+":"+m.teamId}>
            <AppText weight="semibold">{m.homeTeamName}  VS  {m.awayTeamName}</AppText>
            <AppText variant="caption" muted>{m.competitionName} · {m.teamName}</AppText>
            <AppText variant="caption" muted>{date(m.startsAt)} · {tr("matchStatus."+m.status)}</AppText>
            {m.venueName?<AppText variant="caption" muted>{m.venueName}</AppText>:null}
            {m.homeScore!==null&&m.awayScore!==null?
              <AppText weight="bold" style={{color:colors.primary}}>{m.homeScore} : {m.awayScore}</AppText>:null}
            <AppText variant="caption" muted>{tr("lineupStatus")}: {tr("lineup."+m.lineupStatus)}</AppText>
            {m.myStatistics?<AppText variant="caption" muted>
              {tr("goals")}: {m.myStatistics.goals} · {tr("assists")}: {m.myStatistics.assists}
              {" · "}{tr("yellowCards")}: {m.myStatistics.yellowCards}
              {" · "}{tr("redCards")}: {m.myStatistics.redCards}
            </AppText>:null}
            <Button variant="secondary" label={tr("matchDetails")} onPress={()=>router.push({
              pathname:"/competitions/[competitionId]/matches/[matchId]",
              params:{competitionId:m.competitionId,matchId:m.id},
            })}/>
          </View>)}
        </Card>}
      </>:null}

      {tab==="schedule"?<Card>
        <AppText variant="bodyLarge" weight="bold">{tr("myCalendar")}</AppText>
        <Options selected={view} onChange={x=>setView(x as ViewMode)}
          values={["DAY","WEEK","MONTH"].map(id=>({id,label:tr("calendar."+id)}))}/>
        <View style={[styles.rowHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Button label="‹" variant="secondary" onPress={()=>moved(-1)}/>
          <AppText weight="semibold">{date(cursor+"T12:00:00Z")}</AppText>
          <Button label="›" variant="secondary" onPress={()=>moved(1)}/>
        </View>
        <Button label={tr("today")} variant="ghost"
          onPress={()=>setCursor(kabulDay(new Date().toISOString()))}/>
        <AppText variant="caption" muted>{tr("conflictsHint")}</AppText>
        {!visibleEvents.length?<AppText muted>{tr("noEvents")}</AppText>:null}
        {visibleEvents.map(a=>{
          const activity=a.activityId?activityById.get(a.activityId):null;
          return <View style={styles.item} key={a.key}>
            <View style={styles.rows}>
              <Ionicons name={a.kind==="MATCH"?"football-outline":a.kind==="BOOKING"?"location-outline":
                a.kind==="TRAINING"?"fitness-outline":"calendar-outline"} size={18} color={colors.primary}/>
              <AppText weight="semibold" style={{flex:1}}>{a.title}</AppText>
            </View>
            <AppText variant="caption" muted>{tr("event."+a.kind)} · {a.subtitle}</AppText>
            <AppText variant="caption" muted>{date(a.startsAt)}
              {a.endsAt?" – "+date(a.endsAt):""}</AppText>
            {conflicts.has(a.key)?<AppText variant="caption" style={{color:colors.danger}}>
              {tr("scheduleConflict")}</AppText>:null}
            {activity?<View style={{gap:spacing.sm}}>
              {activity.location?<AppText variant="caption">{activity.location}</AppText>:null}
              <AppText variant="caption" muted>{tr("myAvailability")}: {activity.myAvailability?
                t(`tm2.rsvp.${activity.myAvailability}` as never):tr("noResponse")}</AppText>
              <View style={styles.rows}>
                {(["AVAILABLE","UNAVAILABLE","UNSURE"] as const).map(val=>
                  <Button key={val} label={t(`tm2.rsvp.${val}` as never)}
                    variant={activity.myAvailability===val?"primary":"secondary"}
                    disabled={!!busy||Date.parse(activity.startsAt)<=Date.now()}
                    loading={busy===activity.id}
                    onPress={()=>void rsvp(activity,val)}/>)}
              </View>
            </View>:null}
            {a.matchId&&a.competitionId?<Button label={tr("matchDetails")} variant="secondary"
              onPress={()=>router.push({pathname:"/competitions/[competitionId]/matches/[matchId]",
                params:{competitionId:a.competitionId!,matchId:a.matchId!}})}/>:null}
            {a.bookingId?<Button label={tr("openBookings")} variant="secondary"
              onPress={()=>router.push("/bookings")}/>:null}
          </View>;
        })}
      </Card>:null}

      {tab==="bookings"?<>
        <Options selected={bookingFilter} onChange={setBookingFilter}
          values={["UPCOMING","COMPLETED","CANCELLED","ALL"].map(id=>({id,label:tr("booking."+id)}))}/>
        <Card>
          <AppText variant="bodyLarge" weight="bold">{tr("myBookings")}</AppText>
          {!shownBookings.length?<AppText muted>{tr("noBookings")}</AppText>:null}
          {shownBookings.sort((a,b)=>Date.parse(b.startsAt)-Date.parse(a.startsAt))
            .map(b=><View style={styles.item} key={b.id}>
              <AppText weight="semibold">{b.venueName}</AppText>
              <AppText variant="caption" muted>{b.areaName} · {date(b.startsAt)}</AppText>
              <AppText variant="caption" muted>{tr("until")}: {date(b.endsAt)}</AppText>
              <AppText weight="semibold">{b.priceAfn} AFN · {t(`booking.status.${b.status}` as never)}</AppText>
              <View style={styles.rows}>
                <Button label={tr("viewVenue")} variant="secondary" onPress={()=>router.push({
                  pathname:"/venues/[venueId]",params:{venueId:b.venueId},
                })}/>
                {b.status!=="CANCELLED"&&Date.parse(b.startsAt)>now?
                  <Button label={tr("cancelBooking")} variant="ghost" disabled={!!busy}
                    onPress={()=>setConfirmCancel(b.id)}/>:null}
              </View>
              {confirmCancel===b.id?<View style={{gap:spacing.sm}}>
                <AppText variant="caption" style={{color:colors.danger}}>{tr("confirmCancellation")}</AppText>
                <View style={styles.rows}>
                  <Button label={tr("confirm")} variant="danger" loading={busy===b.id}
                    disabled={!!busy} onPress={()=>void action(b.id,
                      ()=>bookingApi.cancel(token,b.id),()=>setConfirmCancel(null))}/>
                  <Button label={t("common.cancel")} variant="secondary"
                    onPress={()=>setConfirmCancel(null)}/>
                </View>
              </View>:null}
            </View>)}
          <Button label={tr("findVenue")} onPress={()=>router.push("/venues")}/>
          <Button label={tr("openBookings")} variant="secondary" onPress={()=>router.push("/bookings")}/>
        </Card>
      </>:null}
    </>:null}
  </View>;
}
const styles=StyleSheet.create({
  filter:{borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,
    paddingHorizontal:spacing.md,paddingVertical:spacing.sm,borderRadius:radius.pill},
  filterActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  item:{borderTopWidth:1,borderColor:colors.border,marginTop:spacing.md,paddingTop:spacing.md,gap:spacing.sm},
  rows:{flexDirection:"row",gap:spacing.sm,alignItems:"center",flexWrap:"wrap"},
  rowHeader:{alignItems:"center",justifyContent:"space-between",gap:spacing.sm},
  chip:{color:colors.primary,backgroundColor:colors.primarySoft,borderRadius:radius.sm,padding:spacing.xs},
});
