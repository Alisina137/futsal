import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {SocialFollowStateDto,TeamDto,TeamJoinRequestStatus} from "@leaguekick/contracts";
import {router,useLocalSearchParams} from "expo-router";
import {useCallback,useEffect,useRef,useState} from "react";
import {Image,Modal,Pressable,ScrollView,Share,StyleSheet,View,useWindowDimensions} from "react-native";
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
import {useVisibleTab} from "../../hooks/useVisibleTab";

type Tab="media"|"squad"|"matches"|"competitions"|"stats"|"about";
const navigation:{id:Tab;icon:keyof typeof Ionicons.glyphMap}[]=[
  {id:"media",icon:"images-outline"},{id:"squad",icon:"people-outline"},
  {id:"matches",icon:"football-outline"},{id:"competitions",icon:"trophy-outline"},
  {id:"stats",icon:"stats-chart-outline"},{id:"about",icon:"information-circle-outline"},
];
const subNavigation:Record<Tab,string[]>={
  media:["posts","photos"],squad:["players","leaders"],matches:["upcoming","results"],
  competitions:["active","past"],stats:["overview","form","topPlayers"],about:["overview","members"],
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
    squadSize:"Registered players",captain:"Captain",manager:"Team manager",
    versus:"VS",kickoff:"Kickoff",fullTime:"Full time",live:"Live",postponed:"Postponed",
    scheduled:"Scheduled",resultsVerified:"Recorded result",result:"Result",
    teamForm:"Last 5 completed matches",matchRecord:"Verified match results",
    noCover:"Team cover",activeCompetition:"Active",pastCompetition:"Past",
    showTeam:"View team",playerNumber:"Shirt number",totalCompetitions:"Competitions",
    topPlayers:"Top players",noPublicLeaders:"No verified public player statistics yet.",
    goals:"Goals",assists:"Assists",appearances:"Played",showMore:"Load more posts",
    mediaLoadError:"Could not load older posts.",refresh:"Refresh",viewPost:"View post",
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
    squadSize:"بازیکنان ثبت‌شده",captain:"کپیتان",manager:"مدیر تیم",
    versus:"در برابر",kickoff:"شروع مسابقه",fullTime:"پایان مسابقه",live:"جریان دارد",postponed:"به تعویق افتاده",
    scheduled:"برنامه‌ریزی شده",resultsVerified:"نتیجه ثبت‌شده",result:"نتیجه",
    teamForm:"۵ مسابقه تکمیل‌شده اخیر",matchRecord:"نتایج ثبت‌شده مسابقات",
    noCover:"جلد تیم",activeCompetition:"جاری",pastCompetition:"گذشته",
    showTeam:"نمایش تیم",playerNumber:"شماره پیراهن",totalCompetitions:"رقابت‌ها",
    topPlayers:"بازیکنان برتر",noPublicLeaders:"هنوز آمار تأییدشدهٔ عمومی بازیکنان وجود ندارد.",
    goals:"گل",assists:"پاس گل",appearances:"بازی",showMore:"نمایش پست‌های بیشتر",
    mediaLoadError:"پست‌های قدیمی بارگذاری نشد.",refresh:"تازه‌سازی",viewPost:"نمایش پست",
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
    squadSize:"ثبت شوي لوبغاړي",captain:"لوبډلمشر",manager:"د ټیم مدیر",
    versus:"د",kickoff:"د لوبې پیل",fullTime:"د لوبې پای",live:"روانه ده",postponed:"ځنډېدلې",
    scheduled:"ټاکل شوې",resultsVerified:"ثبت شوې پایله",result:"پایله",
    teamForm:"وروستۍ ۵ بشپړې لوبې",matchRecord:"ثبت شوې لوبې او پایلې",
    noCover:"د ټیم پوښ",activeCompetition:"روانه",pastCompetition:"تېره",
    showTeam:"ټیم وګورئ",playerNumber:"د کمیس شمېره",totalCompetitions:"سیالۍ",
    topPlayers:"غوره لوبغاړي",noPublicLeaders:"تر اوسه تایید شوې عامه د لوبغاړو شمېرې نشته.",
    goals:"ګولونه",assists:"مرستې",appearances:"لوبې",showMore:"نور پوسټونه",
    mediaLoadError:"زاړه پوسټونه پورته نشول.",refresh:"تازه کول",viewPost:"پوسټ وګورئ",
  },
};

export default function TeamDetailExperience(){
  const {teamId}=useLocalSearchParams<{teamId:string}>();
  const id=typeof teamId==="string"?teamId:"";
  const {session}=useAuth(),{t,isRTL,language}=useLocale();
  const {height:viewportHeight,width:viewportWidth}=useWindowDimensions();
  const tx=(key:string)=>words[language][key]??words.en[key]??key;
  const [team,setTeam]=useState<TeamDto|null>(null);
  const [profile,setProfile]=useState<Omit<TeamManagerProfileDetails,"allowJoinRequests"|"whatsappGroupUrl">|null>(null);
  const [member,setMember]=useState(false),[loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [followState,setFollowState]=useState<SocialFollowStateDto|null>(null);
  const [followBusy,setFollowBusy]=useState(false);
  const [joinStatus,setJoinStatus]=useState<TeamJoinRequestStatus|null>(null);
  const [joinAllowed,setJoinAllowed]=useState(false);
  const [joinBusy,setJoinBusy]=useState(false);
  const [tab,setTab]=useState<Tab>("media");
  const [subs,setSubs]=useState<Record<Tab,string>>({
    media:"posts",squad:"players",matches:"upcoming",
    competitions:"active",stats:"overview",about:"overview",
  });
  const [highlights,setHighlights]=useState<TeamPublicHighlights|null>(null);
  const [olderPosts,setOlderPosts]=useState<TeamPublicHighlights["posts"]>([]);
  const [morePostsAvailable,setMorePostsAvailable]=useState(false);
  const [morePostsBusy,setMorePostsBusy]=useState(false);
  const [morePostsError,setMorePostsError]=useState<string|null>(null);
  const postsGeneration=useRef(0);
  const [publicBusy,setPublicBusy]=useState(false);
  const [retryCounter,setRetryCounter]=useState(0);
  const [photo,setPhoto]=useState<string|null>(null);
  const mainNav=useVisibleTab<Tab>(tab);
  const subNav=useVisibleTab<string>(subs[tab]??subNavigation[tab][0]!);
  const lastId=useRef(id);

  const load=useCallback(async()=>{
    if(!id)return;
    setLoading(true);setError(null);
    try{
      const [result,details,policy]=await Promise.all([
        teamApi.publicTeam(id),teamManagerApi.publicDetails(id).catch(()=>null),
        teamApi.publicJoinPolicy(id).catch(()=>({allowJoinRequests:false})),
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
      setMember(isMember);setJoinStatus(request);setJoinAllowed(policy.allowJoinRequests);
    }catch{
      setError(t("teams.publicTeamLoadError"));
    }finally{setLoading(false);}
  },[id,session?.accessToken,session?.user.id,t]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    if(lastId.current===id)return;
    lastId.current=id;setTeam(null);setProfile(null);setHighlights(null);
    postsGeneration.current++;setOlderPosts([]);setMorePostsAvailable(false);
    setMorePostsError(null);setMorePostsBusy(false);setPhoto(null);
    setTab("media");setFollowState(null);setMember(false);setJoinStatus(null);setJoinAllowed(false);
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
      if(live){setHighlights(result);setOlderPosts([]);setMorePostsAvailable(result.posts.length===50);
        setMorePostsError(null);postsGeneration.current++;}
    }).catch(()=>{/* Error state shown through missing highlights. */})
      .finally(()=>{if(live)setPublicBusy(false);});
    return()=>{live=false;};
  },[id,team?.id,tab,highlights,retryCounter]);

  async function loadMorePosts(){
    if(!id||!highlights||morePostsBusy||!morePostsAvailable)return;
    const generation=postsGeneration.current;
    setMorePostsBusy(true);setMorePostsError(null);
    try{
      const existing=[...highlights.posts,...olderPosts];
      const response=await teamPublicApi.posts(id,existing.length,20);
      if(postsGeneration.current!==generation)return;
      const existingIds=new Set(existing.map(post=>post.id));
      setOlderPosts(items=>[...items,...response.posts.filter(post=>!existingIds.has(post.id))]);
      setMorePostsAvailable(response.hasMore);
    }catch{
      if(postsGeneration.current===generation)setMorePostsError(tx("mediaLoadError"));
    }finally{
      if(postsGeneration.current===generation)setMorePostsBusy(false);
    }
  }
  function refreshHighlights(){
    postsGeneration.current++;setOlderPosts([]);setMorePostsAvailable(false);setMorePostsError(null);
    setHighlights(null);setRetryCounter(n=>n+1);
  }
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
    if(!session||member||joinBusy||joinStatus==="PENDING"||!joinAllowed)return;
    setJoinBusy(true);setError(null);
    try{
      const result=await teamApi.requestJoin(session.accessToken,id);
      setJoinStatus(result.request.status);
    }catch{setError(t("teams.joinRequestError"));}
    finally{setJoinBusy(false);}
  }
  async function cancelJoin(){
    if(!session||joinBusy||joinStatus!=="PENDING")return;
    setJoinBusy(true);setError(null);
    try{
      await teamApi.cancelJoin(session.accessToken,id);
      setJoinStatus(null);
    }catch{setError(t("teams.phase4.cancelRequestError"));}
    finally{setJoinBusy(false);}
  }
  async function share(){
    if(!team)return;
    try{await Share.share({message:team.name+" · "+team.city+"\nleaguekick://teams/"+team.id});}
    catch{/* Cancelled native share sheet. */}
  }
  function chooseTab(value:Tab){
    if(value!==tab){
      setSubs(current=>({...current,[value]:subNavigation[value][0]!}));
      setTab(value);
    }
    // Keep current vertical position and only reveal the selected horizontal tab.
    mainNav.focus(value,true);
  }
  const role=team&&session?team.managerUserId===session.user.id?"MANAGER"
    :team.captainUserId===session.user.id?"CAPTAIN":member?"PLAYER":null:null;
  const rowDirection={flexDirection:isRTL?"row-reverse" as const:"row" as const};
  const cover=resolveMediaImageUrl(profile?.coverImageUrl);
  const teamColor=profile?.primaryColor??colors.primary;
  const bigScreen=viewportWidth>=720;
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
    return <View testID="team-squad-grid" style={[styles.squadGrid,rowDirection]}>
      {players.map(player=><Pressable key={player.userId} accessibilityRole="button"
      style={[styles.rosterItem,bigScreen&&styles.rosterItemWide]}
      onPress={()=>router.push({pathname:"/players/[playerId]",params:{playerId:player.userId}})}>
      <Card style={[styles.rosterCard,{borderLeftColor:teamColor}]}>
        <View style={[styles.horizontal,rowDirection]}>
          {resolveMediaImageUrl(player.imageUrl)?<Image source={{uri:resolveMediaImageUrl(player.imageUrl)!}}
            style={styles.playerAvatar}/>:
            <View style={[styles.playerAvatar,styles.avatarEmpty]}>
              <AppText weight="bold" style={{color:colors.primary}}>
                {player.publicDisplayName.slice(0,2).toUpperCase()}
              </AppText>
            </View>}
          <View style={[{flex:1,gap:3},textAlign]}>
            <AppText weight="bold" numberOfLines={1}>{player.publicDisplayName}</AppText>
            <AppText variant="caption" muted numberOfLines={2}>
              {t(`teams.position.${player.position}` as never)}
            </AppText>
            {player.role==="CAPTAIN"||player.role==="MANAGER"?<View
              style={[styles.memberTag,{backgroundColor:colors.primarySoft}]}>
              <AppText variant="caption" weight="bold" style={{color:teamColor}}>
                {tx(player.role==="CAPTAIN"?"captain":"manager")}
              </AppText>
            </View>:null}
          </View>
          {player.shirtNumber?<View style={styles.jerseyBadge}>
            <AppText variant="caption" muted>#{player.shirtNumber}</AppText>
          </View>:null}
          <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={18} color={colors.textMuted}/>
        </View>
      </Card>
    </Pressable>)}</View>;
  }
  function mediaContent(data:TeamPublicHighlights){
    const allPosts=[...data.posts,...olderPosts];
    const posts=subs.media==="photos"?allPosts.filter(p=>!!resolveMediaImageUrl(p.imageUrl)):allPosts;
    const footer=<>
      {morePostsError?<Card><AppText style={{color:colors.danger}}>{morePostsError}</AppText></Card>:null}
      {morePostsAvailable||morePostsError?<Button
        label={tx("showMore")} variant="secondary" loading={morePostsBusy}
        disabled={morePostsBusy} onPress={()=>void loadMorePosts()}/>:null}
    </>;
    if(!posts.length)return <>{empty(tx(subs.media==="photos"?"noPhotos":"noPosts"),"images-outline")}{footer}</>;
    if(subs.media==="photos")return <>
      <View style={styles.photoGrid}>{posts.map(p=>
        <Pressable key={p.id} style={styles.photoCell} accessibilityRole="button"
          onPress={()=>setPhoto(resolveMediaImageUrl(p.imageUrl))}>
          <Image style={styles.photo} source={{uri:resolveMediaImageUrl(p.imageUrl)!}} resizeMode="cover"/>
        </Pressable>)}</View>{footer}
    </>;
    return <>{posts.map(p=><Card key={p.id} style={styles.postCard}>
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
      <View style={[styles.horizontal,rowDirection]}>
        <Button style={{flex:1}} label={tx("viewPost")} variant="secondary"
          onPress={()=>router.push({pathname:"/posts/[postId]",params:{postId:p.id}})}/>
        {session?<Button style={{flex:1}} label={tx("openComments")} variant="secondary"
          onPress={()=>router.push({pathname:"/posts/[postId]/comments",params:{postId:p.id}})}/>:null}
      </View>
    </Card>)}{footer}</>;
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
      <View style={[styles.fixtureHeading,rowDirection]}>
        <View style={{flex:1,gap:3}}>
          <AppText weight="semibold" numberOfLines={1}>{m.competitionName}</AppText>
          <AppText variant="caption" muted>{m.stage}</AppText>
        </View>
        <View style={[styles.fixtureStatus,{backgroundColor:finished(m)?"#DCFCE7":
          m.status==="IN_PROGRESS"?"#DBEAFE":"#FEF3C7"}]}>
          <AppText variant="caption" weight="bold" style={{color:finished(m)?"#166534":
            m.status==="IN_PROGRESS"?"#1D4ED8":"#92400E"}}>
            {tx(finished(m)?"resultsVerified":m.status==="IN_PROGRESS"?"live":
              m.status==="POSTPONED"?"postponed":"scheduled")}
          </AppText>
        </View>
      </View>
      <View style={[styles.scoreRow,rowDirection]}>
        <AppText weight="semibold" style={{flex:1,textAlign:"center"}}>
          {m.homeTeamId===id?team?.name:m.homeTeamName||"—"}
        </AppText>
        <View style={styles.scoreBadge}>
          <AppText weight="bold" style={{color:colors.primary}}>
            {finished(m)?`${m.homeScore??"—"} : ${m.awayScore??"—"}`:tx("versus") }
          </AppText>
        </View>
        <AppText weight="semibold" style={{flex:1,textAlign:"center"}}>
          {m.awayTeamId===id?team?.name:m.awayTeamName||"—"}
        </AppText>
      </View>
      <View style={[styles.fixtureDate,rowDirection]}>
        <Ionicons name="calendar-outline" size={17} color={colors.textMuted}/>
        <AppText variant="caption" muted style={{flex:1}}>
          {m.startsAt?formatCompetitionDateTime(m.startsAt,language):tx("datePending")}
        </AppText>
      </View>
      <Button label={tx("viewMatch")} variant="secondary"
        onPress={()=>router.push({pathname:"/competitions/[competitionId]/matches/[matchId]",
          params:{competitionId:m.competitionId,matchId:m.id}})}/>
    </Card>);
  }
  function competitionsContent(data:TeamPublicHighlights){
    const old=["COMPLETED","ARCHIVED","CANCELLED"];
    const chosen=data.competitions.filter(c=>subs.competitions==="past"?old.includes(c.status):!old.includes(c.status));
    if(!chosen.length)return empty(tx("noCompetitions"),"trophy-outline");
    return chosen.map(c=><Card key={c.id} style={styles.competitionCard}>
      <View style={[styles.horizontal,rowDirection]}>
        <View style={styles.iconCircle}><Ionicons name="trophy-outline" size={22} color={colors.primary}/></View>
        <View style={{flex:1,gap:4}}>
          <AppText weight="bold">{c.name}</AppText>
          <AppText variant="caption" muted>{c.format}</AppText>
        </View>
        <View style={[styles.fixtureStatus,{backgroundColor:old.includes(c.status)?"#F1F5F9":"#E7F0FF"}]}>
          <AppText variant="caption" weight="bold" style={{color:old.includes(c.status)?"#475569":"#1D4ED8"}}>
            {tx(old.includes(c.status)?"pastCompetition":"activeCompetition")}
          </AppText>
        </View>
      </View>
      {c.startsAt?<View style={[styles.fixtureDate,rowDirection]}>
        <Ionicons name="calendar-outline" size={16} color={colors.textMuted}/>
        <AppText variant="caption" muted>{formatCompetitionDateTime(c.startsAt,language)}</AppText>
      </View>:null}
      <Button label={tx("viewCompetition")} variant="secondary"
        onPress={()=>router.push({pathname:"/competitions/[competitionId]",params:{competitionId:c.id}})}/>
    </Card>);
  }
  function statsContent(data:TeamPublicHighlights){
    if(subs.stats==="topPlayers"){
      if(!data.stats.players.length)return empty(tx("noPublicLeaders"),"people-outline");
      return <View testID="team-verified-player-leaders" style={{gap:spacing.sm}}>
        {data.stats.players.map((player,index)=><Pressable key={player.userId}
          accessibilityRole="button" onPress={()=>router.push({
            pathname:"/players/[playerId]",params:{playerId:player.userId}})}>
          <Card style={[styles.fixture,{gap:spacing.sm}]}>
            <View style={[styles.horizontal,rowDirection]}>
              <View style={styles.jerseyBadge}>
                <AppText weight="bold" style={{color:teamColor}}>#{index+1}</AppText>
              </View>
              <AppText weight="semibold" style={{flex:1}} numberOfLines={1}>{player.displayName}</AppText>
              <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={18} color={colors.textMuted}/>
            </View>
            <View style={[styles.horizontal,rowDirection,{justifyContent:"space-around"}]}>
              {([["goals",player.goals],["assists",player.assists],
                ["appearances",player.appearances]] as const).map(([key,value])=>
                <View key={key} style={{flex:1,alignItems:"center",gap:2}}>
                  <AppText weight="bold" style={{color:colors.primary}}>{value}</AppText>
                  <AppText variant="caption" muted>{tx(key)}</AppText>
                </View>)}
            </View>
          </Card>
        </Pressable>)}
      </View>;
    }
    if(subs.stats==="form"){
      const last=data.matches.filter(m=>["COMPLETED","CORRECTED"].includes(m.status)
        &&m.homeScore!==null&&m.awayScore!==null)
        .sort((a,b)=>(Date.parse(b.startsAt??"")||0)-(Date.parse(a.startsAt??"")||0)).slice(0,5);
      if(!last.length)return empty(tx("noForm"),"stats-chart-outline");
      return <Card style={styles.postCard}>
        <AppText variant="bodyLarge" weight="bold">{tx("teamForm")}</AppText>
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
      <AppText variant="bodyLarge" weight="bold">{tx("matchRecord")}</AppText>
      <View style={styles.metricGrid}>{tiles.map(([key,value])=>
        <View key={key} style={styles.metric}>
          <AppText variant="bodyLarge" weight="bold" style={{color:colors.primary,textAlign:"center"}}>
            {String(value)}</AppText>
          <AppText variant="caption" muted style={{textAlign:"center"}}>{tx(key)}</AppText>
        </View>)}</View>
      {s.played>0?<Card style={styles.performanceCard}>
        <AppText weight="semibold">{tx("winRate")}: {s.winRate}%</AppText>
        <View style={styles.performanceTrack}>
          <View style={[styles.performanceFill,{width:`${Math.min(100,Math.max(0,s.winRate))}%`}]}/>
        </View>
        <View style={[styles.horizontal,rowDirection,{justifyContent:"space-between"}]}>
          <AppText variant="caption" muted>{tx("wins")}: {s.wins}</AppText>
          <AppText variant="caption" muted>{tx("draws")}: {s.draws}</AppText>
          <AppText variant="caption" muted>{tx("losses")}: {s.losses}</AppText>
        </View>
      </Card>:empty(tx("noStats"),"stats-chart-outline")}
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
          label={joinStatus==="PENDING"?t("teams.phase4.cancelRequest"):
            !joinAllowed?t("teams.invitationOnly"):t("teams.requestToJoin")}
          disabled={!joinAllowed&&joinStatus!=="PENDING"} loading={joinBusy} variant="secondary"
          onPress={()=>void (joinStatus==="PENDING"?cancelJoin():requestJoin())}/>:null}
        {!member&&!joinAllowed&&joinStatus!=="PENDING"?
          <AppText variant="caption" muted>{t("teams.phase4.invitationOnlyHelp")}</AppText>:null}
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
  return <Screen showHeader>
    <View style={styles.profileCard}>
      <View testID="team-profile-cover" style={[styles.cover,{backgroundColor:teamColor}]}>
        {cover?<Image source={{uri:cover}} resizeMode="cover" style={StyleSheet.absoluteFill}/>:<>
          <Ionicons name="shield-outline" size={62} color="rgba(255,255,255,.75)"/>
          <AppText variant="caption" style={{color:"#FFFFFF"}}>{tx("noCover")}</AppText>
        </>}
      </View>
      <View style={styles.identity}>
        {resolveMediaImageUrl(team.logoUrl)?<Image source={{uri:resolveMediaImageUrl(team.logoUrl)!}}
          style={styles.teamLogo}/>:
          <View style={[styles.teamLogo,styles.avatarEmpty]}>
            <AppText variant="title" weight="bold" style={{color:colors.primary}}>
              {team.name.slice(0,2).toUpperCase()}</AppText>
          </View>}
        <AppText variant="title" weight="bold" style={{textAlign:"center"}}>{team.name}</AppText>
        {profile?.description?<AppText variant="caption" muted
          numberOfLines={2} style={{textAlign:"center"}}>{profile.description}</AppText>:null}
        <View style={[styles.horizontal,rowDirection,{justifyContent:"center"}]}>
          <Ionicons name="location-outline" color={colors.textMuted} size={15}/>
          <AppText muted variant="caption">
            {[team.city,profile?.district,profile?.province].filter(Boolean).join(" · ")}
          </AppText>
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
              label={joinStatus==="PENDING"?t("teams.phase4.cancelRequest"):
                !joinAllowed?t("teams.invitationOnly"):t("teams.requestToJoin")}
              disabled={!session||(!joinAllowed&&joinStatus!=="PENDING")}
              onPress={()=>void (joinStatus==="PENDING"?cancelJoin():requestJoin())}/>}
        </View>
        <View style={[styles.horizontal,rowDirection,{justifyContent:"center"}]}>
          <Pressable accessibilityRole="button" onPress={()=>void share()} style={styles.smallAction}>
            <Ionicons name="share-social-outline" size={20} color={colors.primary}/>
            <AppText variant="caption" weight="semibold">{tx("share")}</AppText>
          </Pressable>
        </View>
        {joinStatus==="PENDING"&&!member?<View style={styles.pending}>
          <Ionicons name="time-outline" size={18} color={colors.warning}/>
          <AppText variant="caption" style={{flex:1}}>{t("teams.joinRequestPendingBody")}</AppText>
        </View>:null}
      </View>
    </View>
    <View style={styles.tabContainer}>
      <ScrollView ref={mainNav.scrollRef} onLayout={mainNav.onViewport}
        onContentSizeChange={mainNav.onContentSize} horizontal showsHorizontalScrollIndicator={false}
        style={{flexGrow:0}} contentContainerStyle={[styles.tabs,rowDirection]}>
        {navigation.map(item=><Pressable key={item.id} accessibilityRole="tab"
          onLayout={event=>mainNav.cellLayout(item.id,event)}
          accessibilityState={{selected:tab===item.id}}
          style={[styles.tab,tab===item.id&&styles.tabSelected]} onPress={()=>chooseTab(item.id)}>
          <Ionicons name={item.icon} size={20} color={tab===item.id?colors.primary:colors.textMuted}/>
          <AppText variant="caption" weight="semibold" style={{color:tab===item.id?colors.primary:colors.textMuted}}>
            {tx(item.id)}</AppText>
        </Pressable>)}
      </ScrollView>
    </View>
    <View style={styles.subFrame}>
      <ScrollView ref={subNav.scrollRef} onLayout={subNav.onViewport}
        onContentSizeChange={subNav.onContentSize}
        horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0}}
        contentContainerStyle={[styles.subRow,rowDirection]}>
        {subNavigation[tab].map(key=><Pressable key={key} accessibilityRole="tab"
          testID={"team-subtab-"+tab+"-"+key}
          accessibilityLabel={tx(key)}
          onLayout={event=>subNav.cellLayout(key,event)}
          accessibilityState={{selected:subs[tab]===key}}
          style={({pressed})=>[styles.sub,subs[tab]===key&&styles.subSelected,
            pressed&&styles.subPressed]}
          onPress={()=>{setSubs(current=>({...current,[tab]:key}));subNav.focus(key,true);}}>
          <AppText variant="body" weight="semibold" numberOfLines={2}
            style={{color:subs[tab]===key?colors.surface:colors.text,textAlign:"center"}}>
            {tx(key)}
          </AppText>
        </Pressable>)}
      </ScrollView>
    </View>
    <View testID="team-tab-content" style={{minHeight:viewportHeight,gap:spacing.md}}>
      {tab==="media"||tab==="matches"||tab==="stats"?
        <View style={[styles.horizontal,rowDirection,{justifyContent:"flex-end"}]}>
          <Button label={tx("refresh")} variant="ghost" disabled={publicBusy}
            onPress={refreshHighlights}/>
        </View>:null}
      {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
        <Button label={tx("retry")} variant="secondary" onPress={()=>void load()}/></Card>:null}
      {content()}
    </View>
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
  cover:{height:160,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center",gap:4},
  identity:{alignItems:"center",gap:spacing.sm,padding:spacing.md,paddingTop:0},
  teamLogo:{height:90,width:90,borderRadius:45,marginTop:-44,borderWidth:4,borderColor:colors.surface},
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
  subFrame:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.md,marginTop:spacing.xs,overflow:"hidden"},
  subRow:{flexGrow:1,gap:spacing.xs,padding:spacing.xs,alignItems:"stretch"},
  sub:{flex:1,minWidth:112,minHeight:48,alignItems:"center",justifyContent:"center",
    borderRadius:radius.sm,borderWidth:1,borderColor:colors.border,
    paddingHorizontal:spacing.sm,paddingVertical:spacing.sm,backgroundColor:colors.surfaceMuted},
  subSelected:{borderColor:colors.primary,backgroundColor:colors.primary},
  subPressed:{opacity:0.8},
  empty:{alignItems:"center",gap:spacing.md,padding:spacing.xl,minHeight:160,justifyContent:"center"},
  squadGrid:{flexWrap:"wrap",gap:spacing.sm,alignItems:"stretch"},
  rosterItem:{width:"100%"},
  rosterItemWide:{width:"48.5%"},
  rosterCard:{padding:spacing.md,borderLeftWidth:3,minHeight:90,justifyContent:"center"},
  memberTag:{paddingHorizontal:spacing.sm,paddingVertical:2,borderRadius:radius.pill,alignSelf:"flex-start"},
  jerseyBadge:{borderRadius:radius.md,padding:spacing.xs,backgroundColor:colors.surfaceMuted},
  playerAvatar:{width:48,height:48,borderRadius:24},
  photoGrid:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  photoCell:{width:"31%",aspectRatio:1,borderRadius:radius.sm,overflow:"hidden"},
  photo:{width:"100%",height:"100%"},
  postCard:{gap:spacing.md,padding:spacing.md},
  postImage:{height:230,width:"100%",borderRadius:radius.md},
  fixture:{gap:spacing.md,padding:spacing.md,borderWidth:1,borderColor:colors.border},
  fixtureHeading:{alignItems:"center",justifyContent:"space-between",gap:spacing.sm},
  fixtureStatus:{paddingHorizontal:spacing.sm,paddingVertical:5,borderRadius:radius.pill},
  fixtureDate:{alignItems:"center",gap:spacing.xs},
  competitionCard:{padding:spacing.md,gap:spacing.md,borderWidth:1,borderColor:colors.border},
  performanceCard:{padding:spacing.md,gap:spacing.md},
  performanceTrack:{height:13,borderRadius:radius.pill,backgroundColor:colors.surfaceMuted,overflow:"hidden"},
  performanceFill:{height:"100%",backgroundColor:colors.success,borderRadius:radius.pill},
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
