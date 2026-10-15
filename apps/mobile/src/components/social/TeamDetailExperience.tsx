import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {SocialFollowStateDto,TeamDto,TeamJoinRequestStatus} from "@leaguekick/contracts";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {useCallback,useEffect,useRef,useState} from "react";
import {Image,Linking,Modal,Pressable,ScrollView,Share,StyleSheet,View,useWindowDimensions} from "react-native";
import {marketingApi,resolveMediaImageUrl,teamApi,teamManagerApi,teamPublicApi,
  type TeamManagerProfileDetails,type TeamPublicHighlights} from "../../lib/api";
import {formatCompetitionDateTime,AFGHANISTAN_TIME_ZONE} from "../../lib/date-time";
import {teamRecentForm,teamPlayerLeaders,safeTeamWinRate,teamResultBreakdown,
  type TeamPlayerStatMetric} from "../../lib/team-detail-stats";
import {teamCompetitionRows,teamCompetitionAvailableFormats,teamCompetitionAvailableStatuses,
  teamCompetitionFixturePreview,type TeamCompetitionFilters} from "../../lib/team-detail-competitions";
import {teamMatchRows,type TeamMatchFilter,type TeamMatchPhase} from "../../lib/team-detail-matches";
import {teamMatchSelectFacets,teamMatchSelectRows} from "../../lib/team-detail-match-facets";
import {emptyVenueMatchFilters,type VenueMatchFilters} from "../../lib/venue-match-filters";
import {VenueMatchSelect} from "../venues/VenueMatchSelect";
import {TeamMatchCard} from "../venues/VenueMatchCard";
import {teamDetailJoinAction,displayTeamFollowerCount,publicTeamTelephoneUrl} from
  "../../lib/team-detail-actions";
import {teamAboutMembershipState,teamAboutLocation,teamAboutFoundedDate,
  teamAboutVenueLink,mayOpenTeamMemberArea} from "../../lib/team-detail-about";
import {AppText} from "../ui/AppText";
import {TextField} from "../ui/TextField";
import {teamSquadView,canDisplayTeamRoster,mayOpenPublicPlayer,squadPositionFilters,
  type SquadPositionFilter} from "../../lib/team-detail-squad";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";
import {Screen} from "../ui/Screen";
import {useAuth} from "../../providers/AuthProvider";
import {useLocale} from "../../providers/LocaleProvider";
import {useVisibleTab} from "../../hooks/useVisibleTab";
import {initialTeamNavigation,switchTeamMain,switchTeamSub,teamDetailSubtabs,
  type TeamDetailSubtabs} from "../../lib/team-detail-navigation";

type Tab="media"|"squad"|"matches"|"competitions"|"stats"|"about";
const navigation:{id:Tab;icon:keyof typeof Ionicons.glyphMap}[]=[
  {id:"media",icon:"images-outline"},{id:"squad",icon:"people-outline"},
  {id:"matches",icon:"football-outline"},{id:"competitions",icon:"trophy-outline"},
  {id:"stats",icon:"stats-chart-outline"},{id:"about",icon:"information-circle-outline"},
];
const subNavigation=teamDetailSubtabs;
const words:Record<"en"|"fa-AF"|"ps-AF",Record<string,string>>={
  en:{
    media:"Media",squad:"Squad",matches:"Matches",competitions:"Competitions",stats:"Statistics",about:"About",
    posts:"Posts",photos:"Photos",players:"Players",leaders:"Leadership",upcoming:"Upcoming",results:"Results",
    active:"Active",past:"Past",overview:"Overview",form:"Recent form",members:"Membership",
    noPosts:"No posts published by this team yet.",noPhotos:"No team photos yet.",
    matchAll:"All",matchLive:"Live",matchScheduled:"Scheduled",matchPostponed:"Postponed",matchWin:"Wins",matchDraw:"Draws",matchLoss:"Losses",matchCup:"Competition",matchNoFilter:"No matches for these filters.",matchOpenCompetition:"Competition details",matchSummary:"Matches shown",matchUnknownScore:"Result pending",
    compShowing:"Showing",compOf:"of",compConfirmed:"Confirmed participant",
    compFilterFormat:"Competition format",compFilterStatus:"Competition status",
    compAll:"All",compNoFiltered:"No competitions match these filters.",
    compStarts:"Starts",compEnds:"Ends",compSchedulePending:"Date not announced",
    compViewMatches:"View matches",compRecentFixture:"Fixture in public feed",
    compLatestResult:"Recorded result in public feed",compRecentNote:"Preview from recent published fixtures only.",
    compLimited:"Showing a recent selection of competitions, not the full history.",
    compBrowse:"Explore competitions",
    compFormatLeague:"League",compFormatKnockout:"Knockout",compFormatGroups:"Group + knockout",
    compStatusOpen:"Registration open",compStatusClosed:"Registration closed",
    compStatusScheduled:"Scheduled",compStatusInProgress:"In progress",
    compStatusCompleted:"Completed",compStatusArchived:"Archived",
    compStatusCancelled:"Cancelled",
    noGames:"No matches to show.",noCompetitions:"No competitions to show.",noRoster:"No players to show.",
    noLeaders:"No captain has been appointed.",privateRoster:"This team's player list is private.",
    error:"Unable to load team updates.",retry:"Try again",share:"Share",joined:"Member",record:"Match record",
    statsAllTime:"All recorded public matches",statsGoalBalance:"Goal balance",
    statsSnapshot:"Recent form uses the latest published fixture snapshot, not every match in the team's history.",
    statsLastFive:"Latest verified results available",
    statsResultWins:"Win",statsResultDraws:"Draw",statsResultLosses:"Loss",
    statsOpponent:"Opponent",statsMatchDetail:"Open match details",
    statsLeaderFilter:"Rank public players by",statsPlayerRanks:"Top 20 public players",
    statsLeaderNote:"Only verified match statistics of active players with public profiles are included.",
    statsLimited:"Public match list is limited to 100 recent fixtures; the all-time overview uses full verified totals.",
    statsRankOf:"of",statsNoForm:"No verified results in the recent public fixture list.",
    played:"Played",wins:"Wins",draws:"Draws",losses:"Losses",goalsFor:"Goals for",
    goalsAgainst:"Goals against",winRate:"Win rate",goalDifference:"Goal difference",
    winsShort:"W",drawsShort:"D",lossesShort:"L",noForm:"No completed matches yet.",
    aboutIntro:"About this team",aboutDetails:"Team details",aboutFoundedMissing:"Founding date not provided",
    aboutLocationMissing:"Location not published",aboutHomeVenue:"Home venue",aboutViewVenue:"View home venue",
    aboutContactTitle:"Public team contact",aboutNoContact:"No public phone number has been provided.",
    aboutContactInfo:"Contact details are shared publicly by the team manager.",
    aboutManageInfo:"Manage team details",aboutMemberStatus:"Your membership status",
    aboutMemberManager:"You manage this team.",aboutMemberCaptain:"You are an approved team captain.",
    aboutMemberPlayer:"You are an approved team player.",aboutMemberPending:"Your join request is waiting for manager approval.",
    aboutMemberSignIn:"Sign in to check eligibility and request to join.",
    aboutMemberVerify:"Verify your email address before requesting membership.",
    aboutMemberRole:"Accounts with an assigned role cannot request to join another team.",
    aboutMemberInvite:"This manager is currently accepting members by invitation only.",
    aboutMemberRejected:"Your previous membership request was declined. You may submit a new request if eligible.",
    aboutMemberCancelled:"Your previous request was cancelled. You can submit a new request if eligible.",
    aboutMemberEligible:"You can submit a request; joining still requires manager approval.",
    aboutSignIn:"Sign in",aboutMemberLinks:"Member resources",
    aboutPrivateLinks:"Activities and announcements require confirmed team membership.",
    aboutManagerWorkspace:"Team management",
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
    signInToFollow:"Sign in to follow",verifiedToJoin:"Verify your email to request membership.",
    verifyEmail:"Verify email",invitationNote:"This team accepts invitations only.",
    quickSquad:"View squad",quickResults:"Recent results",quickAbout:"About team",
    teamContact:"Call team",membershipStatus:"Membership",viewMemberArea:"Member area",
    squadFind:"Search players or jersey numbers",squadAll:"All positions",
    squadVisible:"Visible players",squadOf:"of",squadFiltered:"Matching players",
    squadNotPublic:"Some player profiles are not public.",
    squadNoMatches:"No players match this search and position.",
    squadLeadersHint:"Manager and captain profiles appear here when visible.",
    squadNoPublicLeaders:"Team leadership has no publicly visible profiles.",
    squadPrivateProfile:"Player details are private",squadOpenPlayer:"View player",
  },
  "fa-AF":{
    media:"رسانه",squad:"بازیکنان",matches:"مسابقات",competitions:"رقابت‌ها",stats:"آمار",about:"درباره",
    posts:"پست‌ها",photos:"عکس‌ها",players:"بازیکنان",leaders:"رهبران",upcoming:"آینده",results:"نتایج",
    active:"جاری",past:"گذشته",overview:"نمای کلی",form:"نتایج اخیر",members:"عضویت",
    noPosts:"هنوز پستی منتشر نشده است.",noPhotos:"هنوز عکسی نشر نشده است.",
    matchAll:"همه",matchLive:"زنده",matchScheduled:"برنامه‌ریزی‌شده",matchPostponed:"به تعویق‌افتاده",matchWin:"برد",matchDraw:"مساوی",matchLoss:"باخت",matchCup:"رقابت",matchNoFilter:"برای این فیلترها مسابقه‌ای یافت نشد.",matchOpenCompetition:"جزئیات رقابت",matchSummary:"مسابقات نمایش‌داده‌شده",matchUnknownScore:"نتیجه در انتظار",
    compShowing:"نمایش",compOf:"از",compConfirmed:"اشتراک تأییدشده",
    compFilterFormat:"نوع رقابت",compFilterStatus:"وضعیت رقابت",
    compAll:"همه",compNoFiltered:"رقابتی مطابق این فیلترها یافت نشد.",
    compStarts:"آغاز",compEnds:"پایان",compSchedulePending:"تاریخ هنوز اعلام نشده",
    compViewMatches:"دیدن مسابقات",compRecentFixture:"مسابقه در فهرست عمومی",
    compLatestResult:"نتیجه ثبت‌شده در فهرست عمومی",compRecentNote:"پیش‌نمایش فقط از مسابقات عمومی اخیر است.",
    compLimited:"تنها بخشی از رقابت‌های اخیر نمایش داده می‌شود، نه تمام تاریخچه.",
    compBrowse:"جستجوی رقابت‌ها",
    compFormatLeague:"لیگ",compFormatKnockout:"حذفی",compFormatGroups:"گروهی و حذفی",
    compStatusOpen:"ثبت‌نام باز",compStatusClosed:"ثبت‌نام بسته",
    compStatusScheduled:"برنامه‌ریزی‌شده",compStatusInProgress:"در حال برگزاری",
    compStatusCompleted:"تکمیل‌شده",compStatusArchived:"بایگانی‌شده",
    compStatusCancelled:"لغوشده",
    noGames:"مسابقه‌ای برای نمایش نیست.",noCompetitions:"رقابتی برای نمایش نیست.",noRoster:"بازیکنی برای نمایش نیست.",
    noLeaders:"هنوز کپیتان تعیین نشده است.",privateRoster:"فهرست بازیکنان این تیم خصوصی است.",
    error:"بارگیری معلومات تیم ناموفق بود.",retry:"تلاش دوباره",share:"اشتراک‌گذاری",joined:"عضو",record:"کارنامه مسابقات",
    statsAllTime:"همهٔ مسابقات عمومی ثبت‌شده",statsGoalBalance:"تفاوت گل‌ها",
    statsSnapshot:"فرم اخیر بر اساس تازه‌ترین مسابقات عمومی است، نه تمام تاریخچهٔ تیم.",
    statsLastFive:"آخرین نتایج تأییدشدهٔ موجود",
    statsResultWins:"برد",statsResultDraws:"مساوی",statsResultLosses:"باخت",
    statsOpponent:"حریف",statsMatchDetail:"جزئیات مسابقه",
    statsLeaderFilter:"رتبه‌بندی بازیکنان عمومی بر اساس",statsPlayerRanks:"۲۰ بازیکن برتر با پروفایل عمومی",
    statsLeaderNote:"فقط آمار مسابقات تأییدشدهٔ بازیکنان فعال دارای پروفایل عمومی نمایش داده می‌شود.",
    statsLimited:"فهرست مسابقات عمومی به ۱۰۰ مسابقهٔ اخیر محدود است؛ نمای کلی بر اساس تمام نتایج تأییدشده است.",
    statsRankOf:"از",statsNoForm:"نتیجهٔ تأییدشده‌ای در فهرست مسابقات عمومی اخیر یافت نشد.",
    played:"بازی",wins:"برد",draws:"مساوی",losses:"باخت",goalsFor:"گل زده",
    goalsAgainst:"گل خورده",winRate:"درصد برد",goalDifference:"تفاضل گل",
    winsShort:"ب",drawsShort:"م",lossesShort:"ش",noForm:"هنوز مسابقه تکمیل نشده است.",
    aboutIntro:"درباره این تیم",aboutDetails:"جزئیات تیم",aboutFoundedMissing:"تاریخ تأسیس درج نشده است",
    aboutLocationMissing:"موقعیت منتشر نشده است",aboutHomeVenue:"میدان خانگی",aboutViewVenue:"نمایش میدان خانگی",
    aboutContactTitle:"شماره تماس عمومی تیم",aboutNoContact:"شماره تماس عمومی درج نشده است.",
    aboutContactInfo:"اطلاعات تماس توسط مدیر تیم به‌صورت عمومی نشر می‌شود.",
    aboutManageInfo:"مدیریت اطلاعات تیم",aboutMemberStatus:"وضعیت عضویت شما",
    aboutMemberManager:"شما مدیر این تیم هستید.",aboutMemberCaptain:"شما کپیتان تأییدشدهٔ تیم هستید.",
    aboutMemberPlayer:"شما بازیکن تأییدشدهٔ این تیم هستید.",aboutMemberPending:"درخواست عضویت شما منتظر تأیید مدیر است.",
    aboutMemberSignIn:"برای بررسی شرایط عضویت و درخواست، وارد حساب شوید.",
    aboutMemberVerify:"پیش از درخواست عضویت، ایمیل خود را تأیید کنید.",
    aboutMemberRole:"حساب‌هایی که نقش فعال دارند نمی‌توانند درخواست عضویت تیم دیگر را بفرستند.",
    aboutMemberInvite:"این مدیر در حال حاضر تنها با دعوت عضو می‌پذیرد.",
    aboutMemberRejected:"درخواست قبلی شما رد شد. اگر شرایط را دارید می‌توانید دوباره درخواست دهید.",
    aboutMemberCancelled:"درخواست قبلی شما لغو شد. اگر شرایط را دارید می‌توانید دوباره درخواست دهید.",
    aboutMemberEligible:"می‌توانید درخواست دهید؛ عضویت پس از تأیید مدیر انجام می‌شود.",
    aboutSignIn:"ورود به حساب",aboutMemberLinks:"امکانات اعضا",
    aboutPrivateLinks:"فعالیت‌ها و اعلانات تنها برای اعضای تأییدشده است.",
    aboutManagerWorkspace:"مدیریت تیم",
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
    signInToFollow:"برای دنبال‌کردن وارد شوید",verifiedToJoin:"برای درخواست عضویت ایمیل خود را تأیید کنید.",
    verifyEmail:"تأیید ایمیل",invitationNote:"این تیم فقط با دعوت عضو می‌پذیرد.",
    quickSquad:"دیدن بازیکنان",quickResults:"نتایج اخیر",quickAbout:"درباره تیم",
    teamContact:"تماس با تیم",membershipStatus:"عضویت",viewMemberArea:"بخش اعضا",
    squadFind:"جستجوی بازیکن یا شماره پیراهن",squadAll:"همه پُست‌ها",
    squadVisible:"بازیکنان قابل نمایش",squadOf:"از",squadFiltered:"بازیکنان مطابق",
    squadNotPublic:"پروفایل بعضی بازیکنان عمومی نیست.",
    squadNoMatches:"بازیکنی مطابق جستجو و پُست انتخاب‌شده یافت نشد.",
    squadLeadersHint:"پروفایل مدیر و کپیتان در صورت عمومی‌بودن نمایش داده می‌شود.",
    squadNoPublicLeaders:"پروفایل عمومی برای رهبران تیم موجود نیست.",
    squadPrivateProfile:"جزئیات بازیکن خصوصی است",squadOpenPlayer:"دیدن بازیکن",
  },
  "ps-AF":{
    media:"رسنۍ",squad:"لوبغاړي",matches:"لوبې",competitions:"سیالۍ",stats:"شمېرې",about:"په اړه",
    posts:"پوسټونه",photos:"انځورونه",players:"لوبغاړي",leaders:"مشران",upcoming:"راتلونکې",results:"پایلې",
    active:"روانې",past:"تېرې",overview:"لنډیز",form:"وروستۍ پایلې",members:"غړیتوب",
    noPosts:"تر اوسه پوسټ نشته.",noPhotos:"تر اوسه انځور نشته.",
    matchAll:"ټولې",matchLive:"ژوندۍ",matchScheduled:"ټاکل شوې",matchPostponed:"ځنډېدلې",matchWin:"بریاوې",matchDraw:"مساوي",matchLoss:"ماتې",matchCup:"سیالي",matchNoFilter:"د دې چاڼګرونو لپاره لوبه ونه موندل شوه.",matchOpenCompetition:"د سیالۍ جزییات",matchSummary:"ښودل شوې لوبې",matchUnknownScore:"پایله لا نه ده ثبت شوې",
    compShowing:"ښودل",compOf:"له",compConfirmed:"تایید شوی ګډون",
    compFilterFormat:"د سیالۍ بڼه",compFilterStatus:"د سیالۍ حالت",
    compAll:"ټولې",compNoFiltered:"د دې چاڼګرونو سره برابره سیالي نشته.",
    compStarts:"پیل",compEnds:"پای",compSchedulePending:"نېټه لا نه ده اعلان شوې",
    compViewMatches:"لوبې وګورئ",compRecentFixture:"په عامه لېست کې لوبه",
    compLatestResult:"په عامه لېست کې ثبت شوې پایله",compRecentNote:"دا یوازې د وروستیو عامه لوبو لنډیز دی.",
    compLimited:"یوازې وروستۍ سیالۍ ښودل شوي، بشپړ تاریخ نه دی.",
    compBrowse:"سیالۍ وپلټئ",
    compFormatLeague:"لیګ",compFormatKnockout:"حذفي",compFormatGroups:"ګروپي او حذفي",
    compStatusOpen:"نوم‌لیکنه پرانیستې",compStatusClosed:"نوم‌لیکنه تړلې",
    compStatusScheduled:"ټاکل شوې",compStatusInProgress:"روانه",
    compStatusCompleted:"بشپړه شوې",compStatusArchived:"ارشیف شوې",
    compStatusCancelled:"لغوه شوې",
    noGames:"د ښودلو لوبې نشته.",noCompetitions:"د ښودلو سیالۍ نشته.",noRoster:"لوبغاړي نشته.",
    noLeaders:"تر اوسه کپتان نه دی ټاکل شوی.",privateRoster:"د دې ټیم د لوبغاړو لېست شخصي دی.",
    error:"د ټیم د معلوماتو ترلاسه کول ناکام شول.",retry:"بیا هڅه",share:"شریکول",joined:"غړی",record:"د لوبو ریکارډ",
    statsAllTime:"ټولې ثبت شوې عامه لوبې",statsGoalBalance:"د ګولونو توپیر",
    statsSnapshot:"وروستۍ بڼه یوازې د نويو عامه لوبو پر لېست ولاړه ده، نه د ټیم پر ټول تاریخ.",
    statsLastFive:"وروستۍ تایید شوې پایلې",
    statsResultWins:"بریا",statsResultDraws:"مساوي",statsResultLosses:"ماتې",
    statsOpponent:"سیال",statsMatchDetail:"د لوبې جزییات",
    statsLeaderFilter:"عام لوبغاړي په دې اساس درجه کړئ",statsPlayerRanks:"۲۰ غوره عام لوبغاړي",
    statsLeaderNote:"یوازې د فعالو او عامه پروفایل لرونکو لوبغاړو تایید شوې شمېرې ښودل کېږي.",
    statsLimited:"عامه لوبې وروستیو ۱۰۰ لوبو ته محدودې دي؛ د عمومي شمېرې ټولې تایید شوې پایلې رانغاړي.",
    statsRankOf:"له",statsNoForm:"په وروستي عامه لېست کې تایید شوې پایله نشته.",
    played:"لوبې",wins:"بریا",draws:"مساوي",losses:"ماتې",goalsFor:"وهلي ګولونه",
    goalsAgainst:"خوړلي ګولونه",winRate:"د بریا سلنه",goalDifference:"د ګولونو توپیر",
    winsShort:"ب",drawsShort:"م",lossesShort:"م",noForm:"تر اوسه بشپړه شوې لوبه نشته.",
    aboutIntro:"د دې ټیم په اړه",aboutDetails:"د ټیم جزییات",aboutFoundedMissing:"د جوړېدو نېټه نه ده ورکړل شوې",
    aboutLocationMissing:"ځای نه دی خپور شوی",aboutHomeVenue:"کورنی میدان",aboutViewVenue:"کورنی میدان وګورئ",
    aboutContactTitle:"د ټیم عامه اړیکه",aboutNoContact:"د عامه اړیکې شمېره نه ده ورکړل شوې.",
    aboutContactInfo:"د اړیکې معلومات د ټیم مدیر په عامه ډول خپروي.",
    aboutManageInfo:"د ټیم معلومات سمبالول",aboutMemberStatus:"ستاسو د غړیتوب حالت",
    aboutMemberManager:"تاسو د دې ټیم مدیر یاست.",aboutMemberCaptain:"تاسو تایید شوی لوبډلمشر یاست.",
    aboutMemberPlayer:"تاسو د دې ټیم تایید شوی لوبغاړی یاست.",aboutMemberPending:"ستاسو د غړیتوب غوښتنه د مدیر تایید ته منتظره ده.",
    aboutMemberSignIn:"د غړیتوب شرایطو او غوښتنې لپاره ننوزئ.",
    aboutMemberVerify:"د غړیتوب غوښتنې مخکې خپل برېښنالیک تایید کړئ.",
    aboutMemberRole:"هغه حسابونه چې بل رول لري بل ټیم ته د غړیتوب غوښتنه نشي لېږلی.",
    aboutMemberInvite:"دا مدیر اوس مهال یوازې د بلنې له لارې غړي مني.",
    aboutMemberRejected:"ستاسو پخوانۍ غوښتنه رد شوې. که وړ یاست نو بیا غوښتنه کولای شئ.",
    aboutMemberCancelled:"ستاسو پخوانۍ غوښتنه لغوه شوې. که وړ یاست نو بیا غوښتنه کولای شئ.",
    aboutMemberEligible:"تاسو غوښتنه کولای شئ؛ غړیتوب د مدیر له تایید وروسته کېږي.",
    aboutSignIn:"ننوتل",aboutMemberLinks:"د غړو اسانتیاوې",
    aboutPrivateLinks:"فعالیتونه او اعلانونه یوازې د تایید شویو غړو لپاره دي.",
    aboutManagerWorkspace:"د ټیم اداره",
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
    signInToFollow:"د تعقیب لپاره ننوزئ",verifiedToJoin:"د غړیتوب غوښتنې لپاره خپل برېښنالیک تایید کړئ.",
    verifyEmail:"برېښنالیک تایید کړئ",invitationNote:"دا ټیم یوازې په بلنه غړي مني.",
    quickSquad:"لوبغاړي وګورئ",quickResults:"وروستۍ پایلې",quickAbout:"د ټیم په اړه",
    teamContact:"ټیم ته زنګ",membershipStatus:"غړیتوب",viewMemberArea:"د غړو برخه",
    squadFind:"لوبغاړی یا د کمیس شمېره ولټوئ",squadAll:"ټول ځایونه",
    squadVisible:"ښکاره لوبغاړي",squadOf:"له",squadFiltered:"موندل شوي لوبغاړي",
    squadNotPublic:"د ځینو لوبغاړو پروفایلونه عام نه دي.",
    squadNoMatches:"د لټون او ځای سره برابر لوبغاړی ونه موندل شو.",
    squadLeadersHint:"د مدیر او کپتان پروفایلونه یوازې هغه مهال ښکاري چې عام وي.",
    squadNoPublicLeaders:"د ټیم د مشرانو عام پروفایلونه نشته.",
    squadPrivateProfile:"د لوبغاړي جزییات شخصي دي",squadOpenPlayer:"لوبغاړی وګورئ",
  },
};

export default function TeamDetailExperience(){
  const {teamId,tab:requestedTab,subtab:requestedSub}=useLocalSearchParams<{
    teamId:string;tab?:string;subtab?:string;
  }>();
  const id=typeof teamId==="string"?teamId:"";
  const {session}=useAuth(),{t,isRTL,language}=useLocale();
  const {height:viewportHeight,width:viewportWidth}=useWindowDimensions();
  const tx=(key:string)=>words[language][key]??words.en[key]??key;
  const [team,setTeam]=useState<TeamDto|null>(null);
  const [statMetric,setStatMetric]=useState<TeamPlayerStatMetric>("goals");
  const [competitionFilters,setCompetitionFilters]=useState<{
    active:TeamCompetitionFilters;past:TeamCompetitionFilters;
  }>({active:{format:"all",status:"all"},past:{format:"all",status:"all"}});
  const [matchFilters,setMatchFilters]=useState<{upcoming:TeamMatchFilter;results:TeamMatchFilter}>({upcoming:"all",results:"all"});
  const [matchSelectFilters,setMatchSelectFilters]=useState<Record<TeamMatchPhase,VenueMatchFilters>>({
    upcoming:{...emptyVenueMatchFilters},results:{...emptyVenueMatchFilters},
  });
  // Only public roster identities are eligible for /players/[playerId] links.
  const [publicPlayerIds,setPublicPlayerIds]=useState<string[]>([]);
  const [squadQuery,setSquadQuery]=useState("");
  const [squadPosition,setSquadPosition]=useState<SquadPositionFilter>("ALL");
  const [profile,setProfile]=useState<Omit<TeamManagerProfileDetails,"allowJoinRequests"|"whatsappGroupUrl">|null>(null);
  const [member,setMember]=useState(false),[loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [followState,setFollowState]=useState<SocialFollowStateDto|null>(null);
  const [followBusy,setFollowBusy]=useState(false);
  const [joinStatus,setJoinStatus]=useState<TeamJoinRequestStatus|null>(null);
  const [joinAllowed,setJoinAllowed]=useState(false);
  const [joinBusy,setJoinBusy]=useState(false);
  const [navState,setNavState]=useState(()=>initialTeamNavigation(requestedTab,requestedSub));
  const tab:Tab=navState.main;
  const subs=navState.sub;
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
  const squadPositionNav=useVisibleTab<SquadPositionFilter>(squadPosition);
  function chooseSquadPosition(position:SquadPositionFilter){
    setSquadPosition(position);
    squadPositionNav.focus(position,true);
  }
  const lastId=useRef(id);
  const loadGeneration=useRef(0);
  const followActionSequence=useRef(0);
  const joinActionSequence=useRef(0);
  const actorIdentity=id+"|"+(session?.user.id??"anonymous")+"|"+(session?.accessToken??"");
  const lastActorIdentity=useRef(actorIdentity);

  // Reject stale private data and writes before rendering a different team/account.
  useEffect(()=>{
    if(lastActorIdentity.current===actorIdentity)return;
    const teamChanged=lastId.current!==id;
    lastActorIdentity.current=actorIdentity;
    lastId.current=id;
    loadGeneration.current++;postsGeneration.current++;
    followActionSequence.current++;joinActionSequence.current++;
    setTeam(null);setProfile(null);setMember(false);setJoinStatus(null);setJoinAllowed(false);
    setMatchFilters({upcoming:"all",results:"all"});
    setMatchSelectFilters({upcoming:{...emptyVenueMatchFilters},results:{...emptyVenueMatchFilters}});
    setStatMetric("goals");
    setCompetitionFilters({active:{format:"all",status:"all"},past:{format:"all",status:"all"}});
    setPublicPlayerIds([]);setSquadQuery("");setSquadPosition("ALL");
    setHighlights(null);setOlderPosts([]);setMorePostsAvailable(false);
    setMorePostsBusy(false);setMorePostsError(null);setPublicBusy(false);setPhoto(null);
    setFollowState(null);setFollowBusy(false);setJoinBusy(false);setError(null);
    if(teamChanged)setNavState(initialTeamNavigation(requestedTab,requestedSub));
  },[actorIdentity,id]);

  // Route parameters override a tab only when the caller provides them.
  useEffect(()=>{
    if(requestedTab!==undefined||requestedSub!==undefined)
      setNavState(initialTeamNavigation(requestedTab,requestedSub));
  },[id,requestedTab,requestedSub]);

  const load=useCallback(async()=>{
    if(!id)return;
    const generation=++loadGeneration.current;
    // Phase 8: revalidate on every focus/manual retry *before* exposing member-only
    // roster and navigation. Access may have been revoked while this page was away.
    setLoading(true);setError(null);
    setTeam(null);setProfile(null);setMember(false);setPublicPlayerIds([]);
    setJoinStatus(null);setJoinAllowed(false);setPhoto(null);
    postsGeneration.current++;setHighlights(null);setOlderPosts([]);
    setMorePostsAvailable(false);setMorePostsBusy(false);setMorePostsError(null);
    setPublicBusy(false);
    try{
      const [result,details,policy]=await Promise.all([
        teamApi.publicTeam(id),teamManagerApi.publicDetails(id).catch(()=>null),
        teamApi.publicJoinPolicy(id).catch(()=>({allowJoinRequests:false})),
      ]);
      let next=result.team;
      const publicIds=result.team.privacy==="PUBLIC"?
        result.team.members.map(player=>player.userId):[];
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
      if(loadGeneration.current!==generation)return;
      setPublicPlayerIds(publicIds);
      setTeam(next);setProfile(details?.profile??null);
      setMember(isMember);setJoinStatus(request);setJoinAllowed(policy.allowJoinRequests);
    }catch{
      if(loadGeneration.current===generation)setError(t("teams.publicTeamLoadError"));
    }finally{if(loadGeneration.current===generation)setLoading(false);}
  },[id,session?.accessToken,session?.user.id,t]);
  // Returning from manager, invitations or player pages must refresh roster
  // privileges and pending requests without retaining another team's response.
  useFocusEffect(useCallback(()=>{
    // load() invalidates all private/public snapshots before issuing fresh reads.
    void load();
    return()=>{loadGeneration.current++;postsGeneration.current++;};
  },[load]));
  useFocusEffect(useCallback(()=>{
    if(!session||!id){setFollowState(null);return;}
    let live=true;
    marketingApi.socialFollowState(session.accessToken,"TEAM",id)
      .then(result=>{if(live)setFollowState(result);}).catch(()=>{if(live)setFollowState(null);});
    return()=>{live=false;};
  },[session?.accessToken,id]));
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
    setMorePostsBusy(false);setHighlights(null);setRetryCounter(n=>n+1);
  }
  async function toggleFollow(){
    if(!session||!followState||followBusy)return;
    const action=++followActionSequence.current;
    setFollowBusy(true);setError(null);
    try{
      const result=followState.following
        ?await marketingApi.socialUnfollow(session.accessToken,"TEAM",id)
        :await marketingApi.socialFollow(session.accessToken,"TEAM",id);
      if(action===followActionSequence.current)setFollowState(result);
    }catch{
      if(action===followActionSequence.current)setError(t("social.followError"));
    }finally{
      if(action===followActionSequence.current)setFollowBusy(false);
    }
  }
  async function requestJoin(){
    if(!session||joinAction!=="request"||joinBusy)return;
    const action=++joinActionSequence.current;
    setJoinBusy(true);setError(null);
    try{
      const result=await teamApi.requestJoin(session.accessToken,id);
      if(action===joinActionSequence.current)setJoinStatus(result.request.status);
    }catch{
      if(action===joinActionSequence.current)setError(t("teams.joinRequestError"));
    }finally{
      if(action===joinActionSequence.current)setJoinBusy(false);
    }
  }
  async function cancelJoin(){
    if(!session||joinBusy||joinAction!=="cancel")return;
    const action=++joinActionSequence.current;
    setJoinBusy(true);setError(null);
    try{
      await teamApi.cancelJoin(session.accessToken,id);
      if(action===joinActionSequence.current)setJoinStatus(null);
    }catch{
      if(action===joinActionSequence.current)setError(t("teams.phase4.cancelRequestError"));
    }finally{
      if(action===joinActionSequence.current)setJoinBusy(false);
    }
  }
  async function share(){
    if(!team)return;
    try{await Share.share({message:team.name+" · "+team.city+"\nleaguekick://teams/"+team.id});}
    catch{/* Cancelled native share sheet. */}
  }
  async function callTeam(){
    if(!contactHref)return;
    try{await Linking.openURL(contactHref);}
    catch{setError(tx("error"));}
  }
  function chooseTab(value:Tab,target?:TeamDetailSubtabs[Tab]){
    setNavState(current=>switchTeamMain(current,value,target));
    // Keep vertical position; reveal the selected horizontal tab in RTL/LTR.
    mainNav.focus(value,true);
    if(target)subNav.focus(target,true);
  }
  const role=team&&session?team.managerUserId===session.user.id?"MANAGER"
    :member&&team.captainUserId===session.user.id?"CAPTAIN":member?"PLAYER":null:null;
  const joinAction=teamDetailJoinAction({
    signedIn:!!session,emailVerified:session?.user.emailVerified===true,
    hasAssignedRole:(session?.user.roles.length??0)>0,
    member,manager:role==="MANAGER",pending:joinStatus==="PENDING",
    allowJoinRequests:joinAllowed,
  });
  const contactHref=team?.privacy==="PUBLIC"?publicTeamTelephoneUrl(profile?.contactPhone):null;
  const homeVenueId=teamAboutVenueLink(team?.privacy??"PRIVATE",profile?.homeVenueId);
  const foundedLabel=teamAboutFoundedDate(profile?.foundedOn,language);
  const aboutPlace=teamAboutLocation(team?.city??"",profile?.district,profile?.province);
  const hasMemberAccess=mayOpenTeamMemberArea({member,isManager:role==="MANAGER"});
  const memberPresentation=teamAboutMembershipState({role,joinStatus,action:joinAction});
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
    if(!visible||!canDisplayTeamRoster(team.privacy,member,role==="MANAGER"))
      return empty(tx("privateRoster"),"lock-closed-outline");

    const leadersOnly=subs.squad==="leaders";
    const listing=teamSquadView(team.members,team.managerUserId,team.captainUserId,{
      query:leadersOnly?"":squadQuery,
      position:leadersOnly?"ALL":squadPosition,
      leadersOnly,
    });
    const restricted=team.rosterCount>team.members.length;
    return <View style={styles.squadSection}>
      <Card style={styles.squadOverview} testID="team-squad-summary">
        <View style={[styles.horizontal,rowDirection,{justifyContent:"space-between"}]}>
          <View style={{flex:1,gap:3}}>
            <AppText variant="bodyLarge" weight="bold">{tx(leadersOnly?"leaders":"players")}</AppText>
            <AppText variant="caption" muted>
              {tx("squadVisible")}: {listing.visibleCount} {tx("squadOf")} {team.rosterCount}
            </AppText>
          </View>
          <View style={styles.squadCountBadge}>
            <AppText weight="bold" style={{color:colors.primary}}>{listing.members.length}</AppText>
          </View>
        </View>
        {restricted?<View style={[styles.horizontal,rowDirection]}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted}/>
          <AppText variant="caption" muted style={{flex:1}}>{tx("squadNotPublic")}</AppText>
        </View>:null}
        {leadersOnly?<AppText variant="caption" muted>{tx("squadLeadersHint")}</AppText>:null}
      </Card>

      {!leadersOnly?<>
        <TextField testID="team-squad-search" label={tx("squadFind")}
          value={squadQuery} onChangeText={setSquadQuery}
          autoCorrect={false} maxLength={80} returnKeyType="search"/>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          testID="team-squad-position-nav"
          ref={squadPositionNav.scrollRef}
          onLayout={squadPositionNav.onViewport}
          onContentSizeChange={squadPositionNav.onContentSize}
          style={{flexGrow:0}} contentContainerStyle={[styles.squadFilters,rowDirection]}>
          {squadPositionFilters.map(position=><Pressable key={position}
            testID={"team-squad-filter-"+position}
            accessibilityRole="tab" accessibilityLabel={position==="ALL"?tx("squadAll"):
              t(`teams.position.${position}` as never)}
            accessibilityState={{selected:squadPosition===position}}
            onLayout={event=>squadPositionNav.cellLayout(position,event)}
            onPress={()=>chooseSquadPosition(position)}
            style={[styles.squadFilter,squadPosition===position&&styles.squadFilterActive]}>
            <AppText variant="caption" weight="semibold"
              style={{color:squadPosition===position?"#FFFFFF":colors.primary}}>
              {position==="ALL"?tx("squadAll"):t(`teams.position.${position}` as never)}
            </AppText>
          </Pressable>)}
        </ScrollView>
        <AppText variant="caption" muted>{tx("squadFiltered")}: {listing.members.length}</AppText>
      </>:null}

      {!listing.members.length?empty(
        leadersOnly?tx(team.captainUserId?"squadNoPublicLeaders":"noLeaders"):
          (squadQuery.trim()||squadPosition!=="ALL")?tx("squadNoMatches"):tx("noRoster"),
        leadersOnly?"ribbon-outline":"people-outline"
      ):<View testID="team-squad-grid" style={[styles.squadGrid,rowDirection]}>
        {listing.members.map(player=>{
          const canOpenPlayer=mayOpenPublicPlayer(player.userId,publicPlayerIds);
          const isManager=player.userId===team.managerUserId;
          const isCaptain=player.userId===team.captainUserId;
          return <Pressable key={player.userId} accessibilityRole="button"
            testID={"team-squad-player-"+player.userId}
            accessibilityLabel={player.publicDisplayName}
            accessibilityHint={canOpenPlayer?tx("squadOpenPlayer"):tx("squadPrivateProfile")}
            accessibilityState={{disabled:!canOpenPlayer}} disabled={!canOpenPlayer}
            style={({pressed})=>[styles.rosterItem,bigScreen&&styles.rosterItemWide,
              pressed&&canOpenPlayer&&styles.subPressed]}
            onPress={()=>router.push({pathname:"/players/[playerId]",params:{playerId:player.userId}})}>
            <Card style={[styles.rosterCard,{borderLeftColor:teamColor}]}>
              <View style={[styles.horizontal,rowDirection]}>
                {resolveMediaImageUrl(player.imageUrl)?<Image
                  source={{uri:resolveMediaImageUrl(player.imageUrl)!}} style={styles.playerAvatar}/>:
                  <View style={[styles.playerAvatar,styles.avatarEmpty]}>
                    <AppText weight="bold" style={{color:colors.primary}}>
                      {player.publicDisplayName.slice(0,2).toUpperCase()}
                    </AppText>
                  </View>}
                <View style={[{flex:1,gap:3},textAlign]}>
                  <AppText weight="bold" numberOfLines={2}>{player.publicDisplayName}</AppText>
                  <AppText variant="caption" muted numberOfLines={2}>
                    {t(`teams.position.${player.position}` as never)}
                  </AppText>
                  {isManager||isCaptain?<View style={styles.memberTag}>
                    <AppText variant="caption" weight="bold" style={{color:colors.primary}}>
                      {tx(isManager?"manager":"captain")}
                    </AppText>
                  </View>:null}
                </View>
                {player.shirtNumber?<View style={styles.jerseyBadge}>
                  <AppText variant="caption" weight="semibold">#{player.shirtNumber}</AppText>
                </View>:null}
                {canOpenPlayer?<Ionicons name={isRTL?"chevron-back":"chevron-forward"}
                  size={18} color={colors.textMuted}/>:null}
              </View>
            </Card>
          </Pressable>;
        })}
      </View>}
    </View>;
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
    const phase=subs.matches;
    const selected=matchFilters[phase],faceted=matchSelectFilters[phase];
    const all=teamMatchRows(data.matches,id,phase);
    const rows=teamMatchSelectRows(data.matches,id,phase,faceted,AFGHANISTAN_TIME_ZONE,selected);
    const options=teamMatchSelectFacets(data.matches,id,phase,AFGHANISTAN_TIME_ZONE);
    const filters:TeamMatchFilter[]=phase==="results"?
      ["all","win","draw","loss"]:["all","live","scheduled","postponed"];
    const label=(filter:TeamMatchFilter)=>tx(({all:"matchAll",live:"matchLive",
      scheduled:"matchScheduled",postponed:"matchPostponed",win:"matchWin",
      draw:"matchDraw",loss:"matchLoss"} as const)[filter]);
    const setSelect=(key:keyof VenueMatchFilters,value:string)=>
      setMatchSelectFilters(current=>({...current,[phase]:{...current[phase],[key]:value}}));
    const formatMonth=(month:number)=>new Intl.DateTimeFormat(language==="en"?"en-GB":language,{
      calendar:"gregory",timeZone:"UTC",month:"long",
    }).format(new Date(Date.UTC(2024,month-1,1)));
    const statusLabel=(m:TeamPublicHighlights["matches"][number])=>
      m.status==="COMPLETED"||m.status==="CORRECTED"?tx("resultsVerified"):
        m.status==="IN_PROGRESS"?tx("live"):
        m.status==="POSTPONED"?tx("postponed"):tx("scheduled");
    return <View testID="team-match-list" style={{gap:spacing.md}}>
      <Card style={{gap:spacing.sm}}>
        <View style={[styles.horizontal,rowDirection,{justifyContent:"space-between"}]}>
          <AppText variant="bodyLarge" weight="bold">{tx(phase)}</AppText>
          <AppText variant="caption" muted>{tx("matchSummary")}: {rows.length}/{all.length}</AppText>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{flexGrow:0}} contentContainerStyle={[styles.squadFilters,rowDirection]}>
          {filters.map(value=><Pressable key={value} testID={"team-match-status-"+value}
            accessibilityRole="tab" accessibilityLabel={label(value)}
            accessibilityState={{selected:selected===value}}
            onPress={()=>setMatchFilters(current=>({...current,[phase]:value}))}
            style={[styles.squadFilter,selected===value&&styles.squadFilterActive]}>
            <AppText variant="caption" weight="semibold"
              style={{color:selected===value?"#FFFFFF":colors.primary}}>{label(value)}</AppText>
          </Pressable>)}
        </ScrollView>
      </Card>
      {/* Reuse the Venue > Competitions > Matches five-select design. On mobile
          all five remain in one scrollable row; Team means the opponent. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        testID="team-match-filter-rail" style={{flexGrow:0}}
        contentContainerStyle={[styles.squadFilters,rowDirection,{gap:spacing.sm}]}>
        <VenueMatchSelect testID="team-match-filter-competition" icon="trophy-outline"
          label={t("vd4.matchesFilter.competition")} value={faceted.competitionId}
          allLabel={t("vd4.matchesFilter.all")}
          options={options.competitions.map(item=>({value:item.id,label:item.name}))}
          onSelect={value=>setSelect("competitionId",value)}/>
        <VenueMatchSelect testID="team-match-filter-team" icon="shirt-outline"
          label={t("vd4.matchesFilter.team")} value={faceted.teamId}
          allLabel={t("vd4.matchesFilter.all")}
          options={options.teams.map(item=>({value:item.id,label:item.name}))}
          onSelect={value=>setSelect("teamId",value)}/>
        <VenueMatchSelect testID="team-match-filter-year" icon="calendar-outline"
          label={t("vd4.matchesFilter.year")} value={faceted.year}
          allLabel={t("vd4.matchesFilter.all")}
          options={options.years.map(year=>({value:String(year),label:String(year)}))}
          onSelect={value=>setSelect("year",value)}/>
        <VenueMatchSelect testID="team-match-filter-month" icon="calendar-number-outline"
          label={t("vd4.matchesFilter.month")} value={faceted.month}
          allLabel={t("vd4.matchesFilter.all")}
          options={options.months.map(month=>({value:String(month),label:formatMonth(month)}))}
          onSelect={value=>setSelect("month",value)}/>
        <VenueMatchSelect testID="team-match-filter-week" icon="calendar-clear-outline"
          label={t("vd4.matchesFilter.week")} value={faceted.week}
          allLabel={t("vd4.matchesFilter.all")}
          options={options.weeks.map(week=>({value:String(week),
            label:t("vd4.matchesFilter.weekNumber",{number:week})}))}
          onSelect={value=>setSelect("week",value)}/>
      </ScrollView>
      <View style={[styles.horizontal,rowDirection,{alignItems:"center"}]}>
        <AppText variant="caption" muted style={{flex:1}}>
          {t("vd4.matchesFilter.count",{shown:rows.length,total:all.length})}
        </AppText>
        {Object.values(faceted).some(Boolean)?<Button
          variant="secondary" label={t("vd4.matchesFilter.clear")}
          onPress={()=>setMatchSelectFilters(current=>({
            ...current,[phase]:{...emptyVenueMatchFilters},
          }))}/>:null}
      </View>
      {!rows.length?empty(tx(all.length?"matchNoFilter":"noGames"),"football-outline"):
        rows.map(m=><TeamMatchCard key={m.id} scope={phase}
          timeZone={AFGHANISTAN_TIME_ZONE} statusLabel={statusLabel(m)}
          missingScoreLabel={tx("matchUnknownScore")}
          match={{...m,
            homeTeamName:m.homeTeamId===id?team?.name??m.homeTeamName:m.homeTeamName,
            awayTeamName:m.awayTeamId===id?team?.name??m.awayTeamName:m.awayTeamName,
          }}/>)}
      <AppText variant="caption" muted>{tx("statsSnapshot")}</AppText>
    </View>;
  }
  function competitionsContent(data:TeamPublicHighlights){
    const phase=subs.competitions;
    const filters=competitionFilters[phase];
    const all=teamCompetitionRows(data.competitions,phase);
    const chosen=teamCompetitionRows(data.competitions,phase,filters);
    const formats=teamCompetitionAvailableFormats(data.competitions,phase);
    const statuses=teamCompetitionAvailableStatuses(data.competitions,phase);
    const formatLabels:Record<string,string>={
      LEAGUE:"compFormatLeague",KNOCKOUT:"compFormatKnockout",
      GROUP_KNOCKOUT:"compFormatGroups",
    };
    const statusLabels:Record<string,string>={
      REGISTRATION_OPEN:"compStatusOpen",REGISTRATION_CLOSED:"compStatusClosed",
      SCHEDULED:"compStatusScheduled",IN_PROGRESS:"compStatusInProgress",
      COMPLETED:"compStatusCompleted",ARCHIVED:"compStatusArchived",
      CANCELLED:"compStatusCancelled",
    };
    const statusText=(status:string)=>tx(statusLabels[status]??status);
    const formatText=(format:string)=>tx(formatLabels[format]??format);
    const changeFilter=(key:keyof TeamCompetitionFilters,value:string)=>
      setCompetitionFilters(current=>({...current,[phase]:{
        ...current[phase],[key]:value,
      } as TeamCompetitionFilters}));
    return <View testID="team-competitions-list" style={{gap:spacing.md}}>
      <Card testID="team-competitions-filters" style={styles.competitionFilters}>
        <View style={[styles.horizontal,rowDirection,{justifyContent:"space-between"}]}>
          <AppText variant="bodyLarge" weight="bold">{tx(phase)}</AppText>
          <AppText variant="caption" muted>{tx("compShowing")}: {chosen.length} {tx("compOf")} {all.length}</AppText>
        </View>
        {formats.length>1?<View style={{gap:spacing.xs}}>
          <AppText variant="caption" muted>{tx("compFilterFormat")}</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{flexGrow:0}} contentContainerStyle={[styles.squadFilters,rowDirection]}>
            {(["all",...formats] as const).map(format=><Pressable key={format}
              testID={"team-competition-format-"+format} accessibilityRole="button"
              accessibilityLabel={format==="all"?tx("compAll"):formatText(format)}
              accessibilityState={{selected:filters.format===format}}
              onPress={()=>changeFilter("format",format)}
              style={[styles.squadFilter,filters.format===format&&styles.squadFilterActive]}>
              <AppText variant="caption" weight="semibold"
                style={{color:filters.format===format?"#FFFFFF":colors.primary}}>
                {format==="all"?tx("compAll"):formatText(format)}
              </AppText>
            </Pressable>)}
          </ScrollView>
        </View>:null}
        {statuses.length>1?<View style={{gap:spacing.xs}}>
          <AppText variant="caption" muted>{tx("compFilterStatus")}</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{flexGrow:0}} contentContainerStyle={[styles.squadFilters,rowDirection]}>
            {(["all",...statuses] as const).map(status=><Pressable key={status}
              testID={"team-competition-status-"+status} accessibilityRole="button"
              accessibilityLabel={status==="all"?tx("compAll"):statusText(status)}
              accessibilityState={{selected:filters.status===status}}
              onPress={()=>changeFilter("status",status)}
              style={[styles.squadFilter,filters.status===status&&styles.squadFilterActive]}>
              <AppText variant="caption" weight="semibold"
                style={{color:filters.status===status?"#FFFFFF":colors.primary}}>
                {status==="all"?tx("compAll"):statusText(status)}
              </AppText>
            </Pressable>)}
          </ScrollView>
        </View>:null}
      </Card>
      {!chosen.length?empty(tx(all.length?"compNoFiltered":"noCompetitions"),"trophy-outline"):
        chosen.map(comp=>{
          const preview=teamCompetitionFixturePreview(data.matches,id,comp.id);
          const ended=phase==="past";
          const cancelled=comp.status==="CANCELLED";
          const badgeBackground=cancelled?"#FEE2E2":ended?"#F1F5F9":
            comp.status==="IN_PROGRESS"?"#DCFCE7":"#DBEAFE";
          const badgeText=cancelled?"#991B1B":ended?"#475569":
            comp.status==="IN_PROGRESS"?"#166534":"#1D4ED8";
          return <Card key={comp.id} testID={"team-competition-card-"+comp.id}
            style={styles.competitionCard}>
            <View style={[styles.horizontal,rowDirection,{alignItems:"flex-start"}]}>
              <View style={styles.iconCircle}>
                <Ionicons name="trophy-outline" size={22} color={colors.primary}/>
              </View>
              <View style={{flex:1,gap:spacing.xs}}>
                <AppText variant="bodyLarge" weight="bold" numberOfLines={3}
                  style={styles.competitionTitle}>{comp.name}</AppText>
                <AppText variant="caption" muted>{formatText(comp.format)}</AppText>
              </View>
              <View style={[styles.fixtureStatus,{backgroundColor:badgeBackground,maxWidth:"40%"}]}>
                <AppText variant="caption" weight="semibold" numberOfLines={2}
                  style={{color:badgeText,textAlign:"center"}}>{statusText(comp.status)}</AppText>
              </View>
            </View>
            <View style={[styles.horizontal,rowDirection]}>
              <Ionicons name="checkmark-circle-outline" size={17} color={colors.success}/>
              <AppText variant="caption" weight="semibold" style={{color:colors.success}}>
                {tx("compConfirmed")}</AppText>
            </View>
            <View style={styles.competitionDates}>
              <InfoLine icon="calendar-outline" label={tx("compStarts")}
                value={comp.startsAt?formatCompetitionDateTime(comp.startsAt,language):
                  tx("compSchedulePending")} rtl={isRTL}/>
              {comp.endsAt?<InfoLine icon="flag-outline" label={tx("compEnds")}
                value={formatCompetitionDateTime(comp.endsAt,language)} rtl={isRTL}/>:null}
            </View>
            {preview?<Pressable testID={"team-competition-preview-"+comp.id}
              accessibilityRole="button" accessibilityLabel={tx(preview.kind==="result"?
                "compLatestResult":"compRecentFixture")}
              style={({pressed})=>[styles.competitionPreview,pressed&&styles.subPressed]}
              onPress={()=>router.push({pathname:"/competitions/[competitionId]/matches/[matchId]",
                params:{competitionId:comp.id,matchId:preview.match.id}})}>
              <View style={[styles.horizontal,rowDirection]}>
                <Ionicons name={preview.kind==="result"?"checkmark-done-circle-outline":
                  "football-outline"} size={18} color={colors.primary}/>
                <View style={{flex:1,gap:2}}>
                  <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
                    {tx(preview.kind==="result"?"compLatestResult":"compRecentFixture")}
                  </AppText>
                  <AppText variant="caption" muted numberOfLines={2}>
                    {preview.match.startsAt?
                      formatCompetitionDateTime(preview.match.startsAt,language):tx("compSchedulePending")}
                    {preview.kind==="result"?
                      ` · ${preview.match.homeScore} : ${preview.match.awayScore}`:""}
                  </AppText>
                </View>
                <Ionicons name={isRTL?"chevron-back":"chevron-forward"}
                  size={18} color={colors.primary}/>
              </View>
              <AppText variant="caption" muted>{tx("compRecentNote")}</AppText>
            </Pressable>:null}
            <View testID={"team-competition-actions-"+comp.id}
              style={[styles.competitionActions,rowDirection]}>
              <CompetitionAction testID={"team-competition-view-"+comp.id}
                label={tx("viewCompetition")} icon="eye-outline" primary rtl={isRTL}
                onPress={()=>router.push({pathname:"/competitions/[competitionId]",
                  params:{competitionId:comp.id}})}/>
              <CompetitionAction testID={"team-competition-matches-"+comp.id}
                label={tx("compViewMatches")} icon="football-outline" rtl={isRTL}
                onPress={()=>router.push({pathname:"/competitions/[competitionId]",
                  params:{competitionId:comp.id,tab:"MATCHES"}})}/>
            </View>
          </Card>;
        })}
      {data.competitions.length>=50?<Card style={styles.competitionFilters}>
        <AppText variant="caption" muted>{tx("compLimited")}</AppText>
        <Button label={tx("compBrowse")} variant="secondary"
          onPress={()=>router.push("/competitions")}/>
      </Card>:null}
    </View>;
  }
  function statsContent(data:TeamPublicHighlights){
    if(subs.stats==="topPlayers"){
      if(!data.stats.players.length)return empty(tx("noPublicLeaders"),"people-outline");
      const rankings=teamPlayerLeaders(data.stats.players,statMetric);
      const criteria:TeamPlayerStatMetric[]=["goals","assists","appearances"];
      return <View testID="team-verified-player-leaders" style={styles.statisticsSection}>
        <Card style={styles.statsFocusCard}>
          <AppText variant="bodyLarge" weight="bold">{tx("statsPlayerRanks")}</AppText>
          <AppText variant="caption" muted>{tx("statsLeaderFilter")}</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{flexGrow:0}} contentContainerStyle={[styles.squadFilters,rowDirection]}>
            {criteria.map(metric=><Pressable key={metric} testID={"team-stat-metric-"+metric}
              accessibilityRole="button" accessibilityLabel={tx(metric)}
              accessibilityState={{selected:statMetric===metric}}
              onPress={()=>setStatMetric(metric)}
              style={[styles.squadFilter,statMetric===metric&&styles.squadFilterActive]}>
              <AppText variant="caption" weight="semibold"
                style={{color:statMetric===metric?"#FFFFFF":colors.primary}}>
                {tx(metric)}
              </AppText>
            </Pressable>)}
          </ScrollView>
          <AppText variant="caption" muted>{tx("statsLeaderNote")}</AppText>
        </Card>
        {rankings.map((player,index)=><Pressable key={player.userId}
          testID={"team-stat-player-"+player.userId} accessibilityRole="button"
          accessibilityLabel={player.displayName+" · "+tx(statMetric)+" "+player[statMetric]}
          accessibilityHint={tx("squadOpenPlayer")}
          onPress={()=>router.push({pathname:"/players/[playerId]",params:{playerId:player.userId}})}>
          <Card style={[styles.fixture,{gap:spacing.sm}]}>
            <View style={[styles.horizontal,rowDirection]}>
              <View style={styles.statRankBadge}>
                <AppText weight="bold" style={{color:colors.primary}}>#{index+1}</AppText>
              </View>
              <View style={{flex:1,gap:3}}>
                <AppText weight="semibold" numberOfLines={2}>{player.displayName}</AppText>
                <AppText variant="caption" muted>{tx(statMetric)}</AppText>
              </View>
              <View style={styles.statLeaderValue}>
                <AppText variant="bodyLarge" weight="bold" style={{color:colors.primary}}>
                  {player[statMetric]}
                </AppText>
              </View>
              <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={18}
                color={colors.textMuted}/>
            </View>
            <View style={[styles.horizontal,rowDirection,{justifyContent:"space-around"}]}>
              {([["goals",player.goals],["assists",player.assists],
                ["appearances",player.appearances]] as const).map(([key,value])=>
                <View key={key} style={{flex:1,alignItems:"center",gap:2}}>
                  <AppText weight="bold" style={{color:colors.text}}>{value}</AppText>
                  <AppText variant="caption" muted style={{textAlign:"center"}}>{tx(key)}</AppText>
                </View>)}
            </View>
          </Card>
        </Pressable>)}
      </View>;
    }
    if(subs.stats==="form"){
      const last=data.matches.filter(m=>["COMPLETED","CORRECTED"].includes(m.status)
        &&m.homeScore!==null&&m.awayScore!==null);
      const recent=teamRecentForm(last,id);
      return <View testID="team-recent-form" style={styles.statisticsSection}>
        <Card style={styles.statsFocusCard}>
          <AppText variant="bodyLarge" weight="bold">{tx("teamForm")}</AppText>
          {recent.length?<View style={[styles.horizontal,{justifyContent:"center"},rowDirection]}>
            {recent.map(({match,outcome})=><View key={match.id}
              style={[styles.formBadge,{backgroundColor:outcome==="win"?"#DDF7E6":
                outcome==="draw"?"#FFF1CC":"#FFE6E6"}]}>
              <AppText weight="bold" style={{color:colors.text}}>
                {tx(outcome==="win"?"winsShort":outcome==="draw"?"drawsShort":"lossesShort")}
              </AppText>
            </View>)}
          </View>:null}
          <AppText variant="caption" muted>{tx("statsSnapshot")}</AppText>
        </Card>
        {!recent.length?empty(tx("statsNoForm"),"stats-chart-outline"):
          recent.map(({match,outcome,ourGoals,theirGoals,opponentName})=>
            <Pressable key={match.id} testID={"team-form-match-"+match.id}
              accessibilityRole="button" accessibilityLabel={tx("statsMatchDetail")}
              style={({pressed})=>[pressed&&styles.subPressed]}
              onPress={()=>router.push({pathname:"/competitions/[competitionId]/matches/[matchId]",
                params:{competitionId:match.competitionId,matchId:match.id}})}>
              <Card style={styles.statFormItem}>
                <View style={[styles.horizontal,rowDirection]}>
                  <View style={[styles.formBadge,styles.formCompactBadge,{backgroundColor:
                    outcome==="win"?"#DDF7E6":outcome==="draw"?"#FFF1CC":"#FFE6E6"}]}>
                    <AppText weight="bold">{tx(outcome==="win"?"winsShort":
                      outcome==="draw"?"drawsShort":"lossesShort")}</AppText>
                  </View>
                  <View style={{flex:1,gap:3}}>
                    <AppText weight="semibold" numberOfLines={2}>
                      {tx("statsOpponent")}: {opponentName||"—"}</AppText>
                    <AppText variant="caption" muted numberOfLines={1}>{match.competitionName}</AppText>
                    <AppText variant="caption" muted>
                      {match.startsAt?formatCompetitionDateTime(match.startsAt,language):tx("datePending")}
                    </AppText>
                  </View>
                  <View style={styles.statFormScore}>
                    <AppText weight="bold" style={{color:colors.primary}}>
                      {ourGoals} : {theirGoals}
                    </AppText>
                  </View>
                  <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={18}
                    color={colors.textMuted}/>
                </View>
              </Card>
            </Pressable>)}
        {data.matches.length>=100?<AppText variant="caption" muted>{tx("statsLimited")}</AppText>:null}
      </View>;
    }
    const s=data.stats;
    const breakdown=teamResultBreakdown(s);
    const tiles:[string,number|string][]=[
      ["played",s.played],["wins",s.wins],["draws",s.draws],["losses",s.losses],
      ["goalsFor",s.goalsFor],["goalsAgainst",s.goalsAgainst],
      ["goalDifference",s.goalDifference],["winRate",s.winRate+"%"],
    ];
    return <View testID="team-stat-overview" style={styles.statisticsSection}>
      <Card style={styles.statsFocusCard}>
        <View style={[styles.horizontal,rowDirection,{justifyContent:"space-between"}]}>
          <View style={{flex:1,gap:spacing.xs}}>
            <AppText variant="bodyLarge" weight="bold">{tx("matchRecord")}</AppText>
            <AppText variant="caption" muted>{tx("statsAllTime")}</AppText>
          </View>
          <View style={styles.statsRateBadge}>
            <AppText variant="title" weight="bold" style={{color:colors.primary}}>
              {s.played>0?s.winRate+"%":"—"}
            </AppText>
            <AppText variant="caption" muted>{tx("winRate")}</AppText>
          </View>
        </View>
        {s.played>0?<View style={{gap:spacing.sm}}>
          <View style={styles.performanceTrack}>
            <View style={[styles.performanceFill,{width:`${safeTeamWinRate(s.winRate)}%`}]}/>
          </View>
          <View testID="team-stat-result-breakdown" style={[styles.statsBreakdown,rowDirection]}>
            <View style={{width:`${breakdown.win}%`,backgroundColor:colors.success}}/>
            <View style={{width:`${breakdown.draw}%`,backgroundColor:colors.warning}}/>
            <View style={{width:`${breakdown.loss}%`,backgroundColor:colors.danger}}/>
          </View>
          <View style={[styles.horizontal,rowDirection,{justifyContent:"space-between"}]}>
            <AppText variant="caption" muted>{tx("wins")}: {s.wins}</AppText>
            <AppText variant="caption" muted>{tx("draws")}: {s.draws}</AppText>
            <AppText variant="caption" muted>{tx("losses")}: {s.losses}</AppText>
          </View>
        </View>:<AppText variant="caption" muted>{tx("noStats")}</AppText>}
      </Card>
      <View style={styles.metricGrid}>{tiles.map(([key,value])=>
        <View key={key} style={styles.metric}>
          <AppText variant="bodyLarge" weight="bold"
            style={{color:colors.primary,textAlign:"center"}}>{String(value)}</AppText>
          <AppText variant="caption" muted style={{textAlign:"center"}}>{tx(key)}</AppText>
        </View>)}</View>
      <Card style={styles.statsFocusCard}>
        <AppText weight="semibold">{tx("statsGoalBalance")}: {s.goalDifference}</AppText>
        <View style={[styles.horizontal,rowDirection,{justifyContent:"space-between"}]}>
          <AppText variant="caption" muted>{tx("goalsFor")}: {s.goalsFor}</AppText>
          <AppText variant="caption" muted>{tx("goalsAgainst")}: {s.goalsAgainst}</AppText>
        </View>
      </Card>
    </View>;
  }
  function aboutContent(){
    if(!team)return null;
    if(subs.about==="overview")return <View testID="team-about-overview" style={styles.aboutSection}>
      <Card style={styles.aboutCard}>
        <View style={[styles.horizontal,rowDirection]}>
          <Ionicons name="information-circle-outline" size={22} color={colors.primary}/>
          <AppText variant="bodyLarge" weight="bold">{tx("teamInformation")}</AppText>
        </View>
        {profile?.description?<AppText style={{lineHeight:23}}>{profile.description}</AppText>:
          <AppText muted>{tx("emptyProfile")}</AppText>}
        <View style={styles.aboutDivider}/>
        <AppText weight="semibold">{tx("aboutDetails")}</AppText>
        <InfoLine icon="location-outline" label={tx("location")}
          value={aboutPlace||tx("aboutLocationMissing")} rtl={isRTL}/>
        <InfoLine icon="calendar-outline" label={tx("founded")}
          value={foundedLabel??tx("aboutFoundedMissing")} rtl={isRTL}/>
        <InfoLine icon="shield-checkmark-outline" label={tx("privacy")}
          value={t(`teams.privacy.${team.privacy}` as never)} rtl={isRTL}/>
        <InfoLine icon="people-outline" label={tx("squadSize")}
          value={String(team.rosterCount)} rtl={isRTL}/>
        {homeVenueId?<View testID="team-about-home-venue" style={{gap:spacing.sm}}>
          <Button label={tx("aboutViewVenue")} variant="secondary"
            icon={<Ionicons name="location-outline" size={17} color={colors.primary}/>}
            onPress={()=>router.push({pathname:"/venues/[venueId]",
              params:{venueId:homeVenueId}})}/>
        </View>:null}
        {role==="MANAGER"?<Button label={tx("aboutManageInfo")} variant="secondary"
          onPress={()=>router.push({pathname:"/teams/[teamId]/manage",
            params:{teamId:id}})}/>:null}
      </Card>
      <Card testID="team-about-contact" style={styles.aboutCard}>
        <View style={[styles.horizontal,rowDirection]}>
          <Ionicons name="call-outline" size={21} color={colors.primary}/>
          <AppText variant="bodyLarge" weight="bold">{tx("aboutContactTitle")}</AppText>
        </View>
        {contactHref?<InfoLine icon="call-outline" label={tx("contact")}
          value={profile?.contactPhone??""} rtl={isRTL}/>:
          <AppText muted>{tx("aboutNoContact")}</AppText>}
        {contactHref?<Button label={tx("teamContact")} variant="secondary"
          icon={<Ionicons name="call-outline" size={17} color={colors.primary}/>}
          onPress={()=>void callTeam()}/>:null}
        <AppText variant="caption" muted>{tx("aboutContactInfo")}</AppText>
      </Card>
    </View>;
    return <View testID="team-about-membership" style={styles.aboutSection}>
      <Card style={styles.aboutCard}>
        <View style={[styles.horizontal,rowDirection]}>
          <Ionicons name={hasMemberAccess?"shield-checkmark-outline":
            joinAction==="cancel"?"time-outline":"people-outline"}
            size={23} color={colors.primary}/>
          <AppText variant="bodyLarge" weight="bold" style={{flex:1}}>
            {tx("aboutMemberStatus")}
          </AppText>
        </View>
        {role?<View style={styles.aboutMembershipBadge}>
          <AppText weight="semibold" style={{color:colors.primary}}>
            {t("teams.myRole")}: {t(`teams.role.${role}` as never)}
          </AppText>
        </View>:null}
        <AppText testID="team-about-membership-message">
          {tx(({
            manager:"aboutMemberManager",captain:"aboutMemberCaptain",player:"aboutMemberPlayer",
            pending:"aboutMemberPending",signIn:"aboutMemberSignIn",
            "verifyEmail":"aboutMemberVerify",roleRestricted:"aboutMemberRole",
            invitationOnly:"aboutMemberInvite",rejected:"aboutMemberRejected",
            cancelled:"aboutMemberCancelled",eligible:"aboutMemberEligible",
          } as const)[memberPresentation])}
        </AppText>
        {!hasMemberAccess?<AppText variant="caption" muted>{tx("joinDescription")}</AppText>:null}
        {joinStatus==="PENDING"&&!hasMemberAccess?<View style={[styles.horizontal,rowDirection]}>
          <Ionicons name="time-outline" size={18} color={colors.warning}/>
          <AppText variant="caption" muted style={{flex:1}}>
            {t("teams.joinRequestPending")}
          </AppText>
        </View>:null}
        {(joinAction==="request"||joinAction==="cancel")?<View testID="team-about-join-action">
          <Button variant="secondary" loading={joinBusy}
            label={joinAction==="cancel"?t("teams.phase4.cancelRequest"):t("teams.requestToJoin")}
            onPress={()=>void (joinAction==="cancel"?cancelJoin():requestJoin())}/>
        </View>:null}
        {joinAction==="signIn"?<View testID="team-about-sign-in"><Button
          label={tx("aboutSignIn")} variant="secondary"
          onPress={()=>router.push("/login")}/></View>:null}
        {joinAction==="verifyEmail"?<View testID="team-about-verify-email"><Button
          label={tx("verifyEmail")} variant="secondary"
          onPress={()=>router.push("/profile/email")}/></View>:null}
        {joinAction==="invitationOnly"?<AppText variant="caption" muted>
          {tx("invitationNote")}</AppText>:null}
      </Card>
      <Card testID="team-about-member-resources" style={styles.aboutCard}>
        <View style={[styles.horizontal,rowDirection]}>
          <Ionicons name={hasMemberAccess?"folder-open-outline":"lock-closed-outline"}
            size={21} color={colors.primary}/>
          <AppText variant="bodyLarge" weight="bold">{tx("aboutMemberLinks")}</AppText>
        </View>
        {hasMemberAccess?<>
          <Button label={tx("viewActivity")} variant="secondary"
            onPress={()=>router.push({pathname:"/teams/[teamId]/activities",
              params:{teamId:id}})}/>
          <Button label={tx("announcements")} variant="secondary"
            onPress={()=>router.push({pathname:"/teams/[teamId]/announcements",
              params:{teamId:id}})}/>
          {role==="MANAGER"?<Button label={tx("aboutManagerWorkspace")}
            variant="secondary" onPress={()=>router.push({pathname:"/teams/[teamId]/manage",
              params:{teamId:id}})}/>:null}
        </>:<View style={[styles.horizontal,rowDirection]}>
          <Ionicons name="lock-closed-outline" size={17} color={colors.textMuted}/>
          <AppText variant="caption" muted style={{flex:1}}>
            {tx("aboutPrivateLinks")}
          </AppText>
        </View>}
      </Card>
    </View>;
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
  if(lastActorIdentity.current!==actorIdentity||(team&&team.id!==id))
    return <Screen showHeader><DataLoadingState variant="detail" minHeight={480}/></Screen>;
  if(loading&&!team)return <Screen showHeader><DataLoadingState variant="detail" minHeight={480}/></Screen>;
  if(!team)return <Screen showHeader><Card style={styles.empty}>
    <AppText style={{color:colors.danger}}>{error??t("teams.publicTeamLoadError")}</AppText>
    <Button label={tx("retry")} onPress={()=>void load()}/>
  </Card></Screen>;
  return <Screen showHeader>
    <View style={styles.profileCard}>
      <View testID="team-profile-cover" style={[styles.cover,{backgroundColor:teamColor}]}>
        {cover?<Image source={{uri:cover}} resizeMode="cover" style={StyleSheet.absoluteFill}/>:<>
          <View style={styles.coverCircleLarge}/>
          <View style={styles.coverCircleSmall}/>
          <Ionicons name="shield-outline" size={54} color="rgba(255,255,255,.82)"/>
          <AppText variant="caption" style={{color:"#FFFFFF"}}>{tx("noCover")}</AppText>
        </>}
        <Pressable testID="team-header-share" accessibilityRole="button"
          accessibilityLabel={tx("share")} onPress={()=>void share()}
          style={[styles.coverShare,{right:isRTL?undefined:spacing.sm,left:isRTL?spacing.sm:undefined}]}>
          <Ionicons name="share-social-outline" size={20} color="#FFFFFF"/>
        </Pressable>
      </View>
      <View style={styles.identity}>
        {resolveMediaImageUrl(team.logoUrl)?<Image source={{uri:resolveMediaImageUrl(team.logoUrl)!}}
          style={styles.teamLogo}/>:
          <View style={[styles.teamLogo,styles.avatarEmpty]}>
            <AppText variant="title" weight="bold" style={{color:colors.primary}}>
              {team.name.slice(0,2).toUpperCase()}</AppText>
          </View>}
        <AppText variant="title" weight="bold" numberOfLines={3}
          style={styles.teamName}>{team.name}</AppText>
        {profile?.description?<AppText variant="caption" muted
          numberOfLines={2} style={{textAlign:"center"}}>{profile.description}</AppText>:null}
        <View style={[styles.horizontal,rowDirection,{justifyContent:"center"}]}>
          <Ionicons name="location-outline" color={colors.textMuted} size={15}/>
          <AppText muted variant="caption" numberOfLines={2} style={{flexShrink:1,textAlign:"center"}}>
            {[team.city,profile?.district,profile?.province].filter(Boolean).join(" · ")}
          </AppText>
          {role?<AppText weight="semibold" variant="caption" style={{color:colors.primary}}>
            {" · "}{t(`teams.role.${role}` as never)}</AppText>:null}
        </View>
        <View style={[styles.summary,rowDirection]}>
          <SummaryStat label={t("publicProfile.members")} value={String(team.rosterCount)}/>
          <SummaryStat label={t("publicProfile.followers")}
            value={displayTeamFollowerCount(followState?.followerCount)}/>
          <SummaryStat label={t("publicProfile.privacy")}
            value={t(`teams.privacy.${team.privacy}` as never)}/>
        </View>
        <View testID="team-header-actions" style={[styles.actionRow,rowDirection]}>
          <Button style={styles.actionButton} variant={followState?.following?"secondary":"primary"}
            label={!session?tx("signInToFollow"):followState?.following?t("social.unfollow"):t("social.follow")}
            loading={followBusy} disabled={!!session&&!followState}
            onPress={()=>session?void toggleFollow():router.push("/login")}/>
          {role==="MANAGER"?<Button style={styles.actionButton} label={t("teams.manage")}
            variant="secondary"
            onPress={()=>router.push({pathname:"/teams/[teamId]/manage",params:{teamId:id}})}/>:
            role?<Button style={styles.actionButton} label={tx("viewMemberArea")}
              variant="secondary" onPress={()=>chooseTab("about","members")}/>:
            (joinAction==="request"||joinAction==="cancel")?<Button
              style={styles.actionButton} variant="secondary" loading={joinBusy}
              label={joinAction==="cancel"?t("teams.phase4.cancelRequest"):t("teams.requestToJoin")}
              onPress={()=>void (joinAction==="cancel"?cancelJoin():requestJoin())}/>:null}
        </View>
        {joinAction==="verifyEmail"?<View testID="team-verify-email-hint"
          style={[styles.membershipHint,rowDirection]}>
          <Ionicons name="mail-unread-outline" size={19} color={colors.primary}/>
          <AppText variant="caption" style={{flex:1}}>{tx("verifiedToJoin")}</AppText>
          <Pressable accessibilityRole="button" onPress={()=>router.push("/profile/email")}>
            <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
              {tx("verifyEmail")}</AppText>
          </Pressable>
        </View>:null}
        {joinAction==="invitationOnly"?<View style={[styles.membershipHint,rowDirection]}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted}/>
          <AppText variant="caption" muted style={{flex:1}}>{tx("invitationNote")}</AppText>
        </View>:null}
        <View testID="team-header-shortcuts" style={[styles.shortcuts,rowDirection]}>
          {([
            {id:"squad",sub:"players",icon:"people-outline",text:"quickSquad"},
            {id:"matches",sub:"results",icon:"football-outline",text:"quickResults"},
            {id:"about",sub:"overview",icon:"information-circle-outline",text:"quickAbout"},
          ] as const).map(item=><Pressable key={item.id} accessibilityRole="button"
            testID={"team-shortcut-"+item.id} accessibilityLabel={tx(item.text)}
            onPress={()=>chooseTab(item.id,item.sub)} style={({pressed})=>[
              styles.shortcut,pressed&&styles.subPressed]}>
            <Ionicons name={item.icon} size={19} color={colors.primary}/>
            <AppText variant="caption" weight="semibold" numberOfLines={2}
              style={{textAlign:"center",color:colors.primary}}>{tx(item.text)}</AppText>
          </Pressable>)}
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
          testID={"team-main-tab-"+item.id} accessibilityLabel={tx(item.id)}
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
          onPress={()=>{
            setNavState(current=>switchTeamSub(current,tab,key as TeamDetailSubtabs[Tab]));
            subNav.focus(key,true);
          }}>
          <AppText variant="body" weight="semibold" numberOfLines={2}
            style={{color:subs[tab]===key?colors.surface:colors.text,textAlign:"center"}}>
            {tx(key)}
          </AppText>
        </Pressable>)}
      </ScrollView>
    </View>
    <View testID="team-tab-content" style={{minHeight:viewportHeight,gap:spacing.md}}>
      <View testID="team-detail-refresh" style={[styles.horizontal,rowDirection,
        {justifyContent:"flex-end"}]}>
        <Button label={tx("refresh")} variant="ghost"
          disabled={loading||publicBusy}
          onPress={tab==="squad"||tab==="about"?()=>void load():refreshHighlights}/>
      </View>
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

/** Local compact CTAs: preserve the app-wide Button dimensions elsewhere.
 * Two actions must remain single-line, readable and tappable in narrow RTL/LTR cards. */
function CompetitionAction({label,icon,onPress,primary=false,rtl,testID}:{
  label:string;icon:keyof typeof Ionicons.glyphMap;onPress:()=>void;
  primary?:boolean;rtl:boolean;testID:string;
}){
  return <Pressable testID={testID} accessibilityRole="button"
    accessibilityLabel={label} onPress={onPress}
    style={({pressed})=>[styles.competitionAction,
      primary?styles.competitionActionPrimary:styles.competitionActionSecondary,
      pressed&&styles.subPressed]}>
    <View style={[styles.competitionActionContent,{flexDirection:rtl?"row-reverse":"row"}]}>
      <Ionicons name={icon} size={15} color={primary?colors.surface:colors.primary}/>
      <AppText variant="body" weight="semibold" numberOfLines={1}
        adjustsFontSizeToFit minimumFontScale={0.8}
        style={[styles.competitionActionLabel,{color:primary?colors.surface:colors.primary}]}>
        {label}
      </AppText>
    </View>
  </Pressable>;
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
  cover:{height:184,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center",gap:4,
    position:"relative",overflow:"hidden"},  
  coverCircleLarge:{position:"absolute",width:260,height:260,borderRadius:130,
    borderWidth:32,borderColor:"rgba(255,255,255,.08)",right:-86,top:-110},
  coverCircleSmall:{position:"absolute",width:190,height:190,borderRadius:95,
    backgroundColor:"rgba(255,255,255,.07)",left:-85,bottom:-90},
  coverShare:{position:"absolute",top:spacing.sm,width:44,height:44,
    borderRadius:radius.pill,backgroundColor:"rgba(0,0,0,.42)",
    alignItems:"center",justifyContent:"center"},
  identity:{alignItems:"center",gap:spacing.sm,padding:spacing.md,paddingTop:0},
  teamLogo:{height:84,width:84,borderRadius:42,marginTop:-40,backgroundColor:colors.surface},  
  teamName:{textAlign:"center",maxWidth:"100%",lineHeight:29},
  avatarEmpty:{backgroundColor:colors.primarySoft,justifyContent:"center",alignItems:"center"},
  summary:{width:"100%",justifyContent:"space-between",paddingVertical:spacing.md,borderTopWidth:1,
    borderBottomWidth:1,borderColor:colors.border},
  summaryItem:{flex:1,alignItems:"center",gap:4},
  actionRow:{width:"100%",flexWrap:"wrap",gap:spacing.sm,justifyContent:"center"},
  actionButton:{flexGrow:1,flexBasis:"44%"},
  membershipHint:{width:"100%",alignItems:"center",padding:spacing.sm,gap:spacing.sm,
    backgroundColor:colors.primarySoft,borderRadius:radius.md},
  shortcuts:{width:"100%",gap:spacing.xs,justifyContent:"space-between",marginTop:spacing.xs},
  shortcut:{flex:1,minWidth:0,minHeight:66,backgroundColor:colors.surfaceMuted,
    borderRadius:radius.md,alignItems:"center",justifyContent:"center",
    paddingHorizontal:spacing.xs,paddingVertical:spacing.sm,gap:4},
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
  squadSection:{gap:spacing.md},
  squadOverview:{padding:spacing.md,gap:spacing.sm},
  squadCountBadge:{minWidth:45,minHeight:42,alignItems:"center",justifyContent:"center",
    borderRadius:radius.md,backgroundColor:colors.primarySoft},
  squadFilters:{gap:spacing.xs,paddingVertical:spacing.xs,alignItems:"center"},
  squadFilter:{minHeight:39,justifyContent:"center",borderRadius:radius.pill,
    borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,
    paddingHorizontal:spacing.md,paddingVertical:spacing.xs},
  squadFilterActive:{backgroundColor:colors.primary,borderColor:colors.primary},
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
  competitionCard:{padding:12,gap:12,borderWidth:1,borderColor:colors.border},
  competitionTitle:{fontSize:15,lineHeight:22},
  competitionFilters:{gap:spacing.md,padding:spacing.md},
  competitionDates:{padding:spacing.sm,borderRadius:radius.md,backgroundColor:colors.surfaceMuted,
    gap:spacing.xs},
  competitionPreview:{padding:spacing.sm,borderRadius:radius.md,
    borderWidth:1,borderColor:colors.border,backgroundColor:colors.primarySoft},
  competitionActions:{width:"100%",alignItems:"stretch",gap:spacing.sm,
    paddingTop:spacing.sm,borderTopWidth:1,borderTopColor:colors.border},
  competitionAction:{flex:1,minWidth:0,minHeight:44,paddingVertical:6,paddingHorizontal:6,
    alignItems:"center",justifyContent:"center",borderRadius:radius.md,borderWidth:1},
  competitionActionPrimary:{backgroundColor:colors.primary,borderColor:colors.primary},
  competitionActionSecondary:{backgroundColor:colors.primarySoft,borderColor:"#B9CEF8"},
  competitionActionContent:{width:"100%",gap:4,alignItems:"center",justifyContent:"center"},
  competitionActionLabel:{flexShrink:1,minWidth:0,fontSize:12,lineHeight:17,textAlign:"center"},
  performanceCard:{padding:spacing.md,gap:spacing.md},
  statisticsSection:{gap:spacing.md},
  statsFocusCard:{gap:spacing.md,padding:spacing.md},
  statsRateBadge:{alignItems:"center",justifyContent:"center",minWidth:98,
    paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,
    backgroundColor:colors.primarySoft,borderRadius:radius.md},
  statsBreakdown:{height:9,borderRadius:radius.pill,backgroundColor:colors.surfaceMuted,
    overflow:"hidden",width:"100%"},
  statRankBadge:{minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center",
    backgroundColor:colors.primarySoft,borderRadius:radius.md},
  statLeaderValue:{minWidth:45,minHeight:40,alignItems:"center",justifyContent:"center",
    borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
  statFormItem:{gap:spacing.sm,padding:spacing.md},
  formCompactBadge:{width:36,height:36,borderRadius:18},
  statFormScore:{backgroundColor:colors.primarySoft,borderRadius:radius.md,
    paddingHorizontal:spacing.sm,paddingVertical:spacing.sm},
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
  aboutSection:{gap:spacing.md},
  aboutCard:{gap:spacing.md,padding:spacing.md},
  aboutDivider:{height:1,backgroundColor:colors.border,marginVertical:spacing.xs},
  aboutMembershipBadge:{alignSelf:"flex-start",borderRadius:radius.pill,
    backgroundColor:colors.primarySoft,paddingHorizontal:spacing.md,paddingVertical:spacing.sm},
  infoLine:{gap:spacing.sm,alignItems:"flex-start",paddingVertical:spacing.xs},
  imageBackdrop:{flex:1,backgroundColor:"#071529ED",padding:spacing.lg},
  fullImage:{flex:1,width:"100%"},
});
