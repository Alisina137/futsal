import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {SocialFollowStateDto,TeamDto,TeamJoinRequestStatus} from "@leaguekick/contracts";
import {router,useLocalSearchParams} from "expo-router";
import {useCallback,useEffect,useRef,useState} from "react";
import {Image,Modal,Pressable,ScrollView,Share,StyleSheet,View} from "react-native";
import {marketingApi,resolveMediaImageUrl,teamApi,teamManagerApi,teamPublicApi,
  type TeamManagerProfileDetails,type TeamPublicHighlights} from "../../lib/api";
import {formatCompetitionDateTime} from "../../lib/date-time";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";
import {Screen} from "../ui/Screen";
import {useAuth} from "../../providers/AuthProvider";
import {useLocale} from "../../providers/LocaleProvider";

type Tab="media"|"squad"|"matches"|"competitions"|"stats"|"about";
const navigation:{id:Tab;icon:keyof typeof Ionicons.glyphMap}[]=[
  {id:"media",icon:"images-outline"},{id:"squad",icon:"people-outline"},
  {id:"matches",icon:"football-outline"},{id:"competitions",icon:"trophy-outline"},
  {id:"stats",icon:"stats-chart-outline"},{id:"about",icon:"information-circle-outline"},
];
const subNavigation:Record<Tab,string[]>={
  media:["posts","photos"],squad:["players","leaders"],matches:["upcoming","results"],
  competitions:["active","past"],stats:["overview","form"],about:["overview","members"],
};
const words:Record<"en"|"fa-AF"|"ps-AF",Record<string,string>>={
  en:{
    media:"Media",squad:"Squad",matches:"Matches",competitions:"Competitions",stats:"Statistics",about:"About",
    posts:"Posts",photos:"Photos",players:"Players",leaders:"Leadership",upcoming:"Upcoming",results:"Results",
    active:"Active",past:"Past",overview:"Overview",form:"Recent form",members:"Membership",
    noPosts:"No posts published by this team yet.",noPhotos:"No team photos yet.",
    noGames:"No matches to show.",noCompetitions:"No competitions to show.",noRoster:"No players to show.",
    noLeaders:"No captain has been appointed.",privateRoster:"This team's player list is private.",
    error:"Unable to load team updates.",retry:"Try again",share:"Share",joined:"Member",record:"Match record",
    played:"Played",wins:"Wins",draws:"Draws",losses:"Losses",goalsFor:"Goals for",
    goalsAgainst:"Goals against",winRate:"Win rate",goalDifference:"Goal difference",
    winsShort:"W",drawsShort:"D",lossesShort:"L",noForm:"No completed matches yet.",
    teamInformation:"Team information",location:"Location",founded:"Founded",
    privacy:"Privacy",contact:"Public contact",competition:"Competition",datePending:"Date to be announced",
    joinDescription:"The manager will review your request. Membership is not automatic.",
    memberOnly:"Private team activities are available only to approved members.",
    viewActivity:"My activities",announcements:"Member announcements",
    viewCompetition:"View competition",viewMatch:"Match details",openComments:"Comments",
    emptyProfile:"The team has not added more profile information yet.",close:"Close",
    followHint:"Follow the team for public updates.",noStats:"Stats appear after verified results.",
    status:"Status",back:"All teams",published:"Published",
  },
  "fa-AF":{
    media:"رسانه",squad:"بازیکنان",matches:"مسابقات",competitions:"رقابت‌ها",stats:"آمار",about:"درباره",
    posts:"پست‌ها",photos:"عکس‌ها",players:"بازیکنان",leaders:"رهبران",upcoming:"آینده",results:"نتایج",
    active:"جاری",past:"گذشته",overview:"نمای کلی",form:"نتایج اخیر",members:"عضویت",
    noPosts:"هنوز پستی منتشر نشده است.",noPhotos:"هنوز عکسی نشر نشده است.",
    noGames:"مسابقه‌ای برای نمایش نیست.",noCompetitions:"رقابتی برای نمایش نیست.",noRoster:"بازیکنی برای نمایش نیست.",
    noLeaders:"هنوز کپیتان تعیین نشده است.",privateRoster:"فهرست بازیکنان این تیم خصوصی است.",
    error:"بارگیری معلومات تیم ناموفق بود.",retry:"تلاش دوباره",share:"اشتراک‌گذاری",joined:"عضو",record:"کارنامه مسابقات",
    played:"بازی",wins:"برد",draws:"مساوی",losses:"باخت",goalsFor:"گل زده",
    goalsAgainst:"گل خورده",winRate:"درصد برد",goalDifference:"تفاضل گل",
    winsShort:"ب",drawsShort:"م",lossesShort:"ش",noForm:"هنوز مسابقه تکمیل نشده است.",
    teamInformation:"معلومات تیم",location:"موقعیت",founded:"تأسیس",
    privacy:"حریم خصوصی",contact:"شماره تماس عمومی",competition:"رقابت",datePending:"تاریخ بعداً اعلام می‌شود",
    joinDescription:"مدیر تیم درخواست شما را بررسی می‌کند؛ عضویت خودکار نیست.",
    memberOnly:"فعالیت‌های خصوصی فقط برای اعضای تأییدشده است.",
    viewActivity:"فعالیت‌های من",announcements:"اعلانات اعضا",
    viewCompetition:"دیدن رقابت",viewMatch:"جزئیات مسابقه",openComments:"دیدگاه‌ها",
    emptyProfile:"تیم هنوز معلومات بیشتری اضافه نکرده است.",close:"بستن",
    followHint:"برای دیدن خبرهای عمومی تیم، آن را دنبال کنید.",noStats:"آمار پس از تأیید نتایج نمایش داده می‌شود.",
    status:"وضعیت",back:"همه تیم‌ها",published:"نشر شده",
  },
  "ps-AF":{
    media:"رسنۍ",squad:"لوبغاړي",matches:"لوبې",competitions:"سیالۍ",stats:"شمېرې",about:"په اړه",
    posts:"پوسټونه",photos:"انځورونه",players:"لوبغاړي",leaders:"مشران",upcoming:"راتلونکې",results:"پایلې",
    active:"روانې",past:"تېرې",overview:"لنډیز",form:"وروستۍ پایلې",members:"غړیتوب",
    noPosts:"تر اوسه پوسټ نشته.",noPhotos:"تر اوسه انځور نشته.",
    noGames:"د ښودلو لوبې نشته.",noCompetitions:"د ښودلو سیالۍ نشته.",noRoster:"لوبغاړي نشته.",
    noLeaders:"تر اوسه کپتان نه دی ټاکل شوی.",privateRoster:"د دې ټیم د لوبغاړو لېست شخصي دی.",
    error:"د ټیم د معلوماتو ترلاسه کول ناکام شول.",retry:"بیا هڅه",share:"شریکول",joined:"غړی",record:"د لوبو ریکارډ",
    played:"لوبې",wins:"بریا",draws:"مساوي",losses:"ماتې",goalsFor:"وهلي ګولونه",
    goalsAgainst:"خوړلي ګولونه",winRate:"د بریا سلنه",goalDifference:"د ګولونو توپیر",
    winsShort:"ب",drawsShort:"م",lossesShort:"م",noForm:"تر اوسه بشپړه شوې لوبه نشته.",
    teamInformation:"د ټیم معلومات",location:"ځای",founded:"تأسیس",
    privacy:"محرمیت",contact:"عامه اړیکه",competition:"سیالي",datePending:"نېټه به وروسته اعلان شي",
    joinDescription:"د ټیم مدیر به ستاسو غوښتنه وارزوي؛ غړیتوب اتومات نه دی.",
    memberOnly:"شخصي فعالیتونه یوازې د تایید شوو غړو لپاره دي.",
    viewActivity:"زما فعالیتونه",announcements:"د غړو اعلانونه",
    viewCompetition:"سیالي وګورئ",viewMatch:"د لوبې جزییات",openComments:"تبصرې",
    emptyProfile:"ټیم لا ډېر معلومات نه دي اضافه کړي.",close:"بندول",
    followHint:"د ټیم د عامه خبرونو لپاره یې تعقیب کړئ.",noStats:"شمېرې له تایید شوو پایلو وروسته څرګندېږي.",
    status:"حالت",back:"ټول ټیمونه",published:"خپور شوی",
  },
};

export default function TeamDetailExperience(){
  const {teamId}=useLocalSearchParams<{teamId:string}>();
  const id=typeof teamId==="string"?teamId:"";
  const {session}=useAuth(),{t,isRTL,language}=useLocale();
  const tx=(key:string)=>words[language][key]??words.en[key]??key;
  const [team,setTeam]=useState<TeamDto|null>(null);
  const [profile,setProfile]=useState<Omit<TeamManagerProfileDetails,"allowJoinRequests"|"whatsappGroupUrl">|null>(null);
  const [member,setMember]=useState(false),[loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [followState,setFollowState]=useState<SocialFollowStateDto|null>(null);
  const [followBusy,setFollowBusy]=useState(false);
  const [joinStatus,setJoinStatus]=useState<TeamJoinRequestStatus|null>(null);
  const [joinBusy,setJoinBusy]=useState(false);
  const [tab,setTab]=useState<Tab>("media");
  const [subs,setSubs]=useState<Record<Tab,string>>({
    media:"posts",squad:"players",matches:"upcoming",
    competitions:"active",stats:"overview",about:"overview",
  });
  const [highlights,setHighlights]=useState<TeamPublicHighlights|null>(null);
  const [publicBusy,setPublicBusy]=useState(false);
  const [retryCounter,setRetryCounter]=useState(0);
  const [photo,setPhoto]=useState<string|null>(null);
  const screenScroll=useRef<ScrollView>(null),navScroll=useRef<ScrollView>(null);
  const lastId=useRef(id);

  const load=useCallback(async()=>{
    if(!id)return;
    setLoading(true);setError(null);
    try{
      const [result,details]=await Promise.all([
        teamApi.publicTeam(id),teamManagerApi.publicDetails(id).catch(()=>null),
      ]);
      let next=result.team;
      let isMember=false,request:TeamJoinRequestStatus|null=null;
      if(session){
        try{
          const mine=await teamApi.mine(session.accessToken);
          isMember=mine.teams.some(item=>item.id===id);
          if(isMember||next.managerUserId===session.user.id){
            next=(await teamApi.roster(session.accessToken,id)).team;
          }else{
            request=(await teamApi.joinRequest(session.accessToken,id)).request?.status??null;
          }
        }catch{/* Public team details remain usable when private reads fail. */}
      }
      setTeam(next);setProfile(details?.profile??null);
      setMember(isMember);setJoinStatus(request);
    }catch{
      setError(t("teams.publicTeamLoadError"));
    }finally{setLoading(false);}
  },[id,session?.accessToken,session?.user.id,t]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    if(lastId.current===id)return;
    lastId.current=id;setTeam(null);setProfile(null);setHighlights(null);
    setTab("media");setFollowState(null);setMember(false);setJoinStatus(null);
  },[id]);
  useEffect(()=>{
    if(!session||!id)return;
    let live=true;
    marketingApi.socialFollowState(session.accessToken,"TEAM",id)
      .then(result=>{if(live)setFollowState(result);}).catch(()=>{});
    return()=>{live=false;};
  },[session?.accessToken,id]);
  useEffect(()=>{
    if(!team||team.id!==id||highlights||tab==="squad"||tab==="about")return;
    let live=true;
    setPublicBusy(true);
    void teamPublicApi.highlights(id).then(result=>{
      if(live){setHighlights(result);}
    }).catch(()=>{/* Error state shown through missing highlights. */})
      .finally(()=>{if(live)setPublicBusy(false);});
    return()=>{live=false;};
  },[id,team?.id,tab,highlights,retryCounter]);

  async function toggleFollow(){
    if(!session||!followState||followBusy)return;
    setFollowBusy(true);setError(null);
    try{
      setFollowState(followState.following
        ?await marketingApi.socialUnfollow(session.accessToken,"TEAM",id)
        :await marketingApi.socialFollow(session.accessToken,"TEAM",id));
    }catch{setError(t("social.followError"));}
    finally{setFollowBusy(false);}
  }
  async function requestJoin(){
    if(!session||member||joinBusy||joinStatus==="PENDING")return;
    setJoinBusy(true);setError(null);
    try{
      const result=await teamApi.requestJoin(session.accessToken,id);
      setJoinStatus(result.request.status);
    }catch{setError(t("teams.joinRequestError"));}
    finally{setJoinBusy(false);}
  }
  async function share(){
    if(!team)return;
    try{await Share.share({message:team.name+" · "+team.city+"\nleaguekick://teams/"+team.id});}
    catch{/* Cancelled native share sheet. */}
  }
  function chooseTab(value:Tab){
    setTab(value);
    const index=navigation.findIndex(item=>item.id===value);
    navScroll.current?.scrollTo({x:Math.max(0,index-1)*90,animated:true});
    screenScroll.current?.scrollTo({y:0,animated:true});
  }
  const role=team&&session?team.managerUserId===session.user.id?"MANAGER"
    :team.captainUserId===session.user.id?"CAPTAIN":member?"PLAYER":null:null;
  const rowDirection={flexDirection:isRTL?"row-reverse" as const:"row" as const};
  const textAlign={alignItems:isRTL?"flex-end" as const:"flex-start" as const};

  function empty(message:string,icon:keyof typeof Ionicons.glyphMap="file-tray-outline"){
    return <Card style={styles.empty}>
      <Ionicons name={icon} size={29} color={colors.primary}/>
      <AppText muted style={{textAlign:"center"}}>{message}</AppText>
    </Card>;
  }
  function rosterContent(){
    if(!team)return null;
    const visible=team.privacy==="PUBLIC"||member||role==="MANAGER";
    if(!visible)return empty(tx("privateRoster"),"lock-closed-outline");
    const players=subs.squad==="leaders"?team.members.filter(p=>p.role==="CAPTAIN"):team.members;
    if(!players.length)return empty(tx(subs.squad==="leaders"?"noLeaders":"noRoster"),"people-outline");
    return players.map(player=><Pressable key={player.userId} accessibilityRole="button"
      onPress={()=>router.push({pathname:"/players/[playerId]",params:{playerId:player.userId}})}>
      <Card style={styles.rosterCard}>
        <View style={[styles.horizontal,rowDirection]}>
          {resolveMediaImageUrl(player.imageUrl)?<Image source={{uri:resolveMediaImageUrl(player.imageUrl)!}}
            style={styles.playerAvatar}/>:
            <View style={[styles.playerAvatar,styles.avatarEmpty]}>
              <AppText weight="bold" style={{color:colors.primary}}>
                {player.publicDisplayName.slice(0,2).toUpperCase()}
              </AppText>
            </View>}
          <View style={[{flex:1,gap:3},textAlign]}>
            <AppText weight="bold">{player.publicDisplayName}</AppText>
            <AppText variant="caption" muted>{t(`teams.position.${player.position}` as never)}
              {" · "}{t(`teams.role.${player.role}` as never)}
              {player.shirtNumber?" · #"+player.shirtNumber:""}</AppText>
          </View>
          <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={18} color={colors.textMuted}/>
        </View>
      </Card>
    </Pressable>);
  }
  function mediaContent(data:TeamPublicHighlights){
    const posts=subs.media==="photos"?data.posts.filter(p=>!!resolveMediaImageUrl(p.imageUrl)):data.posts;
    if(!posts.length)return empty(tx(subs.media==="photos"?"noPhotos":"noPosts"),"images-outline");
    if(subs.media==="photos")return <View style={styles.photoGrid}>{posts.map(p=>
      <Pressable key={p.id} style={styles.photoCell} accessibilityRole="button"
        onPress={()=>setPhoto(resolveMediaImageUrl(p.imageUrl))}>
        <Image style={styles.photo} source={{uri:resolveMediaImageUrl(p.imageUrl)!}} resizeMode="cover"/>
      </Pressable>)}</View>;
    return posts.map(p=><Card key={p.id} style={styles.postCard}>
      <View style={[styles.horizontal,rowDirection]}>
        <Ionicons name="football" size={20} color={colors.primary}/>
        <View style={{flex:1}}>
          <AppText weight="bold">{team?.name}</AppText>
          <AppText variant="caption" muted>{formatCompetitionDateTime(p.publishedAt,language)}</AppText>
        </View>
      </View>
      {p.body?<AppText>{p.body}</AppText>:null}
      {resolveMediaImageUrl(p.imageUrl)?<Pressable accessibilityRole="button"
        onPress={()=>setPhoto(resolveMediaImageUrl(p.imageUrl))}>
        <Image source={{uri:resolveMediaImageUrl(p.imageUrl)!}} style={styles.postImage}
          resizeMode="cover"/>
      </Pressable>:null}
      {session?<Button label={tx("openComments")} variant="secondary"
        onPress={()=>router.push({pathname:"/posts/[postId]/comments",params:{postId:p.id}})}/>:null}
    </Card>);
  }
  function matchesContent(data:TeamPublicHighlights){
    const finished=(m:TeamPublicHighlights["matches"][number])=>
      ["COMPLETED","CORRECTED"].includes(m.status);
    const rows=data.matches.filter(m=>subs.matches==="results"?finished(m):
      ["SCHEDULED","IN_PROGRESS","POSTPONED"].includes(m.status))
      .sort((a,b)=>subs.matches==="results"
        ?(Date.parse(b.startsAt??"")||0)-(Date.parse(a.startsAt??"")||0)
        :(Date.parse(a.startsAt??"")||Number.MAX_SAFE_INTEGER)-(Date.parse(b.startsAt??"")||Number.MAX_SAFE_INTEGER));
    if(!rows.length)return empty(tx("noGames"),"football-outline");
    return rows.map(m=><Card key={m.id} style={styles.fixture}>
      <AppText variant="caption" muted>{m.competitionName} · {m.stage}</AppText>
      <View style={[styles.scoreRow,rowDirection]}>
        <AppText weight="semibold" style={{flex:1,textAlign:"center"}}>
          {m.homeTeamId===id?team?.name:m.homeTeamName||"—"}
        </AppText>
        <View style={styles.scoreBadge}>
          <AppText weight="bold" style={{color:colors.primary}}>
            {finished(m)?`${m.homeScore??"—"} : ${m.awayScore??"—"}`:"VS"}
          </AppText>
        </View>
        <AppText weight="semibold" style={{flex:1,textAlign:"center"}}>
          {m.awayTeamId===id?team?.name:m.awayTeamName||"—"}
        </AppText>
      </View>
      <AppText variant="caption" muted style={{textAlign:"center"}}>
        {m.startsAt?formatCompetitionDateTime(m.startsAt,language):tx("datePending")}
      </AppText>
      <Button label={tx("viewMatch")} variant="secondary"
        onPress={()=>router.push({pathname:"/competitions/[competitionId]/matches/[matchId]",
          params:{competitionId:m.competitionId,matchId:m.id}})}/>
    </Card>);
  }
  function competitionsContent(data:TeamPublicHighlights){
    const old=["COMPLETED","ARCHIVED","CANCELLED"];
    const chosen=data.competitions.filter(c=>subs.competitions==="past"?old.includes(c.status):!old.includes(c.status));
    if(!chosen.length)return empty(tx("noCompetitions"),"trophy-outline");
    return chosen.map(c=><Card key={c.id} style={styles.postCard}>
      <View style={[styles.horizontal,rowDirection]}>
        <View style={styles.iconCircle}><Ionicons name="trophy-outline" size={22} color={colors.primary}/></View>
        <View style={{flex:1,gap:4}}>
          <AppText weight="bold">{c.name}</AppText>
          <AppText variant="caption" muted>{c.format} · {c.status.replace(/_/g," ")}</AppText>
        </View>
      </View>
      {c.startsAt?<AppText variant="caption" muted>{formatCompetitionDateTime(c.startsAt,language)}</AppText>:null}
      <Button label={tx("viewCompetition")} variant="secondary"
        onPress={()=>router.push({pathname:"/competitions/[competitionId]",params:{competitionId:c.id}})}/>
    </Card>);
  }
  function statsContent(data:TeamPublicHighlights){
    if(subs.stats==="form"){
      const last=data.matches.filter(m=>["COMPLETED","CORRECTED"].includes(m.status)
        &&m.homeScore!==null&&m.awayScore!==null)
        .sort((a,b)=>(Date.parse(b.startsAt??"")||0)-(Date.parse(a.startsAt??"")||0)).slice(0,5);
      if(!last.length)return empty(tx("noForm"),"stats-chart-outline");
      return <Card style={styles.postCard}>
        <AppText variant="bodyLarge" weight="bold">{tx("form")}</AppText>
        <View style={[styles.horizontal,{justifyContent:"center"},rowDirection]}>
          {last.map(m=>{
            const our=m.homeTeamId===id?m.homeScore!:m.awayScore!;
            const theirs=m.homeTeamId===id?m.awayScore!:m.homeScore!;
            const result=our>theirs?"winsShort":our===theirs?"drawsShort":"lossesShort";
            return <View key={m.id} style={[styles.formBadge,{backgroundColor:
              result==="winsShort"?"#DDF7E6":result==="drawsShort"?"#FFF1CC":"#FFE6E6"}]}>
              <AppText weight="bold" style={{color:colors.text}}>{tx(result)}</AppText>
            </View>;
          })}
        </View>
      </Card>;
    }
    const s=data.stats;
    const tiles:[string,number|string][]=[
      ["played",s.played],["wins",s.wins],["draws",s.draws],["losses",s.losses],
      ["goalsFor",s.goalsFor],["goalsAgainst",s.goalsAgainst],
      ["goalDifference",s.goalDifference],["winRate",s.winRate+"%"],
    ];
    return <>
      <AppText variant="bodyLarge" weight="bold">{tx("record")}</AppText>
      <View style={styles.metricGrid}>{tiles.map(([key,value])=>
        <View key={key} style={styles.metric}>
          <AppText variant="bodyLarge" weight="bold" style={{color:colors.primary,textAlign:"center"}}>
            {String(value)}</AppText>
          <AppText variant="caption" muted style={{textAlign:"center"}}>{tx(key)}</AppText>
        </View>)}</View>
      {s.played===0?empty(tx("noStats"),"stats-chart-outline"):null}
    </>;
  }
  function aboutContent(){
    if(!team)return null;
    return <>
      {subs.about==="overview"?<Card style={styles.postCard}>
        <AppText variant="bodyLarge" weight="bold">{tx("teamInformation")}</AppText>
        {profile?.description?<AppText>{profile.description}</AppText>:
          <AppText muted>{tx("emptyProfile")}</AppText>}
        <InfoLine icon="location-outline" label={tx("location")}
          value={[team.city,profile?.district,profile?.province].filter(Boolean).join(" · ")} rtl={isRTL}/>
        {profile?.foundedOn?<InfoLine icon="calendar-outline" label={tx("founded")} value={profile.foundedOn} rtl={isRTL}/>:null}
        <InfoLine icon="shield-checkmark-outline" label={tx("privacy")}
          value={t(`teams.privacy.${team.privacy}` as never)} rtl={isRTL}/>
        {profile?.contactPhone?<InfoLine icon="call-outline" label={tx("contact")}
          value={profile.contactPhone} rtl={isRTL}/>:null}
      </Card>:<Card style={styles.postCard}>
        <AppText variant="bodyLarge" weight="bold">{tx("members")}</AppText>
        <AppText muted>{tx("joinDescription")}</AppText>
        {joinStatus==="PENDING"?<AppText style={{color:colors.warning}} weight="semibold">
          {t("teams.joinRequestPending")}</AppText>:null}
        {!member&&role!=="MANAGER"&&session?<Button
          label={joinStatus==="PENDING"?t("teams.joinRequestPending"):t("teams.requestToJoin")}
          disabled={joinStatus==="PENDING"} loading={joinBusy} variant="secondary"
          onPress={()=>void requestJoin()}/>:null}
        {role?<AppText weight="semibold" style={{color:colors.primary}}>
          {t("teams.myRole")}: {t(`teams.role.${role}` as never)}</AppText>:null}
        {role?<Button label={tx("viewActivity")} variant="secondary"
          onPress={()=>router.push({pathname:"/teams/[teamId]/activities",params:{teamId:id}})}/>:null}
        {role?<Button label={tx("announcements")} variant="secondary"
          onPress={()=>router.push({pathname:"/teams/[teamId]/announcements",params:{teamId:id}})}/>:null}
        {!role?<AppText variant="caption" muted>{tx("memberOnly")}</AppText>:null}
      </Card>}
    </>;
  }
  function content(){
    if(tab==="squad")return rosterContent();
    if(tab==="about")return aboutContent();
    if(publicBusy&&!highlights)return <DataLoadingState variant="list" minHeight={240}/>;
    if(!highlights)return <Card style={styles.empty}>
      <AppText style={{color:colors.danger}}>{tx("error")}</AppText>
      <Button variant="secondary" label={tx("retry")} onPress={()=>{
        setHighlights(null);setRetryCounter(x=>x+1);}}/>
    </Card>;
    if(tab==="media")return mediaContent(highlights);
    if(tab==="matches")return matchesContent(highlights);
    if(tab==="competitions")return competitionsContent(highlights);
    return statsContent(highlights);
  }
  if(loading&&!team)return <Screen showHeader><DataLoadingState variant="detail" minHeight={480}/></Screen>;
  if(!team)return <Screen showHeader><Card style={styles.empty}>
    <AppText style={{color:colors.danger}}>{error??t("teams.publicTeamLoadError")}</AppText>
    <Button label={tx("retry")} onPress={()=>void load()}/>
  </Card></Screen>;
  return <Screen showHeader scrollRef={screenScroll}>
    <View style={styles.profileCard}>
      <View style={styles.cover}><Ionicons name="football-outline" size={58} color="#CEE0FF"/></View>
      <View style={styles.identity}>
        {resolveMediaImageUrl(team.logoUrl)?<Image source={{uri:resolveMediaImageUrl(team.logoUrl)!}}
          style={styles.teamLogo}/>:
          <View style={[styles.teamLogo,styles.avatarEmpty]}>
            <AppText variant="title" weight="bold" style={{color:colors.primary}}>
              {team.name.slice(0,2).toUpperCase()}</AppText>
          </View>}
        <AppText variant="title" weight="bold" style={{textAlign:"center"}}>{team.name}</AppText>
        <View style={[styles.horizontal,rowDirection,{justifyContent:"center"}]}>
          <Ionicons name="location-outline" color={colors.textMuted} size={15}/>
          <AppText muted variant="caption">{team.city}</AppText>
          {role?<AppText weight="semibold" variant="caption" style={{color:colors.primary}}>
            {" · "}{t(`teams.role.${role}` as never)}</AppText>:null}
        </View>
        <View style={[styles.summary,rowDirection]}>
          <SummaryStat label={t("publicProfile.members")} value={String(team.rosterCount)}/>
          <SummaryStat label={t("publicProfile.followers")} value={String(followState?.followerCount??0)}/>
          <SummaryStat label={t("publicProfile.privacy")}
            value={t(`teams.privacy.${team.privacy}` as never)}/>
        </View>
        <View style={[styles.horizontal,rowDirection]}>
          <Button style={{flex:1}} variant={followState?.following?"secondary":"primary"}
            label={followState?.following?t("social.unfollow"):t("social.follow")}
            loading={followBusy} disabled={!session||!followState} onPress={()=>void toggleFollow()}/>
          {role==="MANAGER"?<Button style={{flex:1}} label={t("teams.manage")} variant="secondary"
            onPress={()=>router.push({pathname:"/teams/[teamId]/manage",params:{teamId:id}})}/>:
            member?<Button style={{flex:1}} label={tx("joined")} variant="secondary" disabled onPress={()=>{}}/>:
            <Button style={{flex:1}} variant="secondary" loading={joinBusy}
              label={joinStatus==="PENDING"?t("teams.joinRequestPending"):t("teams.requestToJoin")}
              disabled={!session||joinStatus==="PENDING"} onPress={()=>void requestJoin()}/>}
        </View>
        <View style={[styles.horizontal,rowDirection,{justifyContent:"center"}]}>
          <Pressable accessibilityRole="button" onPress={()=>void share()} style={styles.smallAction}>
            <Ionicons name="share-social-outline" size={20} color={colors.primary}/>
            <AppText variant="caption" weight="semibold">{tx("share")}</AppText>
          </Pressable>
        </View>
        {joinStatus==="PENDING"&&!member?<View style={styles.pending}>
          <Ionicons name="time-outline" size={18} color={colors.warning}/>
          <AppText variant="caption" style={{flex:1}}>{tx("joinDescription")}</AppText>
        </View>:null}
      </View>
    </View>
    <View style={styles.tabContainer}>
      <ScrollView ref={navScroll} horizontal showsHorizontalScrollIndicator={false}
        style={{flexGrow:0}} contentContainerStyle={[styles.tabs,rowDirection]}>
        {navigation.map(item=><Pressable key={item.id} accessibilityRole="tab"
          accessibilityState={{selected:tab===item.id}}
          style={[styles.tab,tab===item.id&&styles.tabSelected]} onPress={()=>chooseTab(item.id)}>
          <Ionicons name={item.icon} size={20} color={tab===item.id?colors.primary:colors.textMuted}/>
          <AppText variant="caption" weight="semibold" style={{color:tab===item.id?colors.primary:colors.textMuted}}>
            {tx(item.id)}</AppText>
        </Pressable>)}
      </ScrollView>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0}}
      contentContainerStyle={[styles.subRow,rowDirection]}>
      {subNavigation[tab].map(key=><Pressable key={key} accessibilityRole="tab"
        accessibilityState={{selected:subs[tab]===key}}
        style={[styles.sub,subs[tab]===key&&styles.subSelected]}
        onPress={()=>setSubs(current=>({...current,[tab]:key}))}>
        <AppText variant="caption" weight="semibold"
          style={{color:subs[tab]===key?"#FFFFFF":colors.primary}}>{tx(key)}</AppText>
      </Pressable>)}
    </ScrollView>
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={tx("retry")} variant="secondary" onPress={()=>void load()}/></Card>:null}
    {content()}
    <Modal visible={!!photo} transparent animationType="fade" onRequestClose={()=>setPhoto(null)}>
      <View style={styles.imageBackdrop}>
        <Button label={tx("close")} variant="secondary" onPress={()=>setPhoto(null)}/>
        {photo?<Image source={{uri:photo}} style={styles.fullImage} resizeMode="contain"/>:null}
      </View>
    </Modal>
  </Screen>;
}

function SummaryStat({label,value}:{label:string;value:string}){
  return <View style={styles.summaryItem}>
    <AppText weight="bold" style={{textAlign:"center",color:colors.primary}}>{value}</AppText>
    <AppText variant="caption" muted style={{textAlign:"center"}}>{label}</AppText>
  </View>;
}
function InfoLine({icon,label,value,rtl}:{icon:keyof typeof Ionicons.glyphMap;
  label:string;value:string;rtl:boolean}){
  return <View style={[styles.infoLine,{flexDirection:rtl?"row-reverse":"row"}]}>
    <Ionicons name={icon} size={19} color={colors.primary}/>
    <View style={{flex:1}}>
      <AppText variant="caption" muted>{label}</AppText>
      <AppText>{value}</AppText>
    </View>
  </View>;
}
const styles=StyleSheet.create({
  horizontal:{flexDirection:"row",gap:spacing.sm,alignItems:"center"},
  profileCard:{borderRadius:radius.lg,backgroundColor:colors.surface,overflow:"hidden"},
  cover:{height:110,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center"},
  identity:{alignItems:"center",gap:spacing.sm,padding:spacing.md,paddingTop:0},
  teamLogo:{height:84,width:84,borderRadius:42,marginTop:-38,borderWidth:4,borderColor:colors.surface},
  avatarEmpty:{backgroundColor:colors.primarySoft,justifyContent:"center",alignItems:"center"},
  summary:{width:"100%",justifyContent:"space-between",paddingVertical:spacing.md,borderTopWidth:1,
    borderBottomWidth:1,borderColor:colors.border},
  summaryItem:{flex:1,alignItems:"center",gap:4},
  smallAction:{flexDirection:"row",gap:5,padding:spacing.sm,alignItems:"center"},
  pending:{flexDirection:"row",gap:spacing.sm,padding:spacing.sm,backgroundColor:colors.surfaceMuted,
    borderRadius:radius.sm,alignItems:"center"},
  tabContainer:{borderTopWidth:1,borderBottomWidth:1,borderColor:colors.border,backgroundColor:colors.surface},
  tabs:{gap:spacing.xs,paddingHorizontal:spacing.xs},
  tab:{minWidth:86,minHeight:67,alignItems:"center",justifyContent:"center",gap:4,
    paddingHorizontal:spacing.sm,borderBottomWidth:3,borderColor:"transparent"},
  tabSelected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  subRow:{gap:spacing.sm,paddingVertical:spacing.sm},
  sub:{borderRadius:radius.pill,paddingHorizontal:spacing.lg,paddingVertical:spacing.sm,
    backgroundColor:colors.surfaceMuted,minHeight:38,justifyContent:"center"},
  subSelected:{backgroundColor:colors.primary},
  empty:{alignItems:"center",gap:spacing.md,padding:spacing.xl,minHeight:160,justifyContent:"center"},
  rosterCard:{padding:spacing.md},
  playerAvatar:{width:48,height:48,borderRadius:24},
  photoGrid:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  photoCell:{width:"31%",aspectRatio:1,borderRadius:radius.sm,overflow:"hidden"},
  photo:{width:"100%",height:"100%"},
  postCard:{gap:spacing.md,padding:spacing.md},
  postImage:{height:230,width:"100%",borderRadius:radius.md},
  fixture:{gap:spacing.md,padding:spacing.md},
  scoreRow:{alignItems:"center",gap:spacing.sm},
  scoreBadge:{paddingHorizontal:spacing.md,paddingVertical:spacing.sm,
    borderRadius:radius.md,backgroundColor:colors.primarySoft,minWidth:68,alignItems:"center"},
  iconCircle:{height:40,width:40,borderRadius:20,backgroundColor:colors.primarySoft,
    justifyContent:"center",alignItems:"center"},
  metricGrid:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  metric:{width:"47%",backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.md,alignItems:"center",justifyContent:"center",gap:spacing.xs,padding:spacing.md},
  formBadge:{height:44,width:44,borderRadius:22,alignItems:"center",justifyContent:"center"},
  infoLine:{gap:spacing.sm,alignItems:"flex-start",paddingVertical:spacing.xs},
  imageBackdrop:{flex:1,backgroundColor:"#071529ED",padding:spacing.lg},
  fullImage:{flex:1,width:"100%"},
});
