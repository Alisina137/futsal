import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {NotificationDto,NotificationListFilter} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useMemo,useState} from "react";
import {Alert,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {notificationApi} from "../../src/lib/api";
import {formatLocalDateTimeParts,formatPostTimeAgo} from "../../src/lib/date-time";
import {publishNotificationUnread} from "../../src/lib/notification-events";
import {AppText} from "../../src/components/ui/AppText";
import {Button} from "../../src/components/ui/Button";
import {Card} from "../../src/components/ui/Card";
import {DataLoadingState} from "../../src/components/ui/DataLoadingState";
import {Screen} from "../../src/components/ui/Screen";
import {useAuth} from "../../src/providers/AuthProvider";
import {useLocale} from "../../src/providers/LocaleProvider";

const PAGE_SIZE=30;
const FILTERS:NotificationListFilter[]=["ALL","UNREAD","BOOKINGS","VENUES","TEAMS","COMPETITIONS"];
type IconName=keyof typeof Ionicons.glyphMap;
const FILTER_ICONS:Record<NotificationListFilter,IconName>={
  ALL:"grid-outline",UNREAD:"mail-unread-outline",BOOKINGS:"calendar-outline",
  VENUES:"football-outline",TEAMS:"people-outline",COMPETITIONS:"trophy-outline",
};
const ICONS:Record<NotificationDto["type"],IconName>={
  BOOKING_CONFIRMED:"checkmark-circle-outline",BOOKING_CANCELLED:"close-circle-outline",
  SLOT_PROMOTION:"pricetag-outline",VENUE_POST:"megaphone-outline",
  TEAM_INVITATION:"people-outline",COMPETITION_UPDATE:"trophy-outline",
  TEAM_ACTIVITY:"calendar-outline",TEAM_CHALLENGE:"football-outline",TEAM_ANNOUNCEMENT:"megaphone-outline",
};
function groupDay(value:string){
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return "";
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kabul",
    year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
}
function dayKey(value:Date){
  return groupDay(value.toISOString());
}
function target(item:NotificationDto):()=>void{
  const id=(key:string)=>typeof item.data[key]==="string"?item.data[key] as string:null;
  switch(item.type){
    case "BOOKING_CONFIRMED":case "BOOKING_CANCELLED":return ()=>router.push("/bookings");
    case "TEAM_INVITATION":return ()=>router.push("/teams/invitations");
    case "TEAM_CHALLENGE":return ()=>router.push("/dashboard");
    case "TEAM_ANNOUNCEMENT":return ()=>{const teamId=id("teamId");if(teamId)router.push({pathname:"/teams/[teamId]/announcements",params:{teamId}});else router.push("/teams");};
    case "TEAM_ACTIVITY":return ()=>{const teamId=id("teamId");if(teamId)router.push({pathname:"/teams/[teamId]/activities",params:{teamId}});else router.push("/teams");};
    case "COMPETITION_UPDATE":return ()=>{
      const competitionId=id("competitionId");
      if(competitionId)router.push({pathname:"/competitions/[competitionId]",params:{competitionId}});
      else router.push("/competitions");
    };
    case "VENUE_POST":return ()=>{
      const postId=id("postId");
      if(postId)router.push({pathname:"/posts/[postId]",params:{postId}});
      else router.push("/venues");
    };
    case "SLOT_PROMOTION":return ()=>{
      const venueId=id("venueId"),promotionId=id("promotionId");
      if(venueId)router.push({pathname:"/venues/[venueId]",params:{venueId,...(promotionId?{promotionId}:{})}});
      else router.push("/venues");
    };
  }
}

export default function NotificationsScreen(){
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const token=session?.accessToken;
  const [filter,setFilter]=useState<NotificationListFilter>("ALL");
  const [items,setItems]=useState<NotificationDto[]>([]);
  const [unreadCount,setUnreadCount]=useState(0);
  const [total,setTotal]=useState(0);
  const [hasMore,setHasMore]=useState(false);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [loadingMore,setLoadingMore]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [retry,setRetry]=useState(0);
  const [actionId,setActionId]=useState<string|null>(null);

  useFocusEffect(useCallback(()=>{
    let active=true;
    if(!token){
      setItems([]);setTotal(0);setUnreadCount(0);setHasMore(false);setLoading(false);
      return()=>{active=false;};
    }
    setLoading(true);setError(null);
    void notificationApi.list(token,{filter,limit:PAGE_SIZE,offset:0}).then(result=>{
      if(!active)return;
      setItems(result.notifications);setTotal(result.total);
      setHasMore(result.hasMore);setUnreadCount(result.unreadCount);
      publishNotificationUnread(token,result.unreadCount);
    }).catch(()=>{
      if(active)setError(t("notifications.loadError"));
    }).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[token,filter,retry,t]));

  async function refresh(){
    if(!token||refreshing)return;
    setRefreshing(true);
    try{
      const result=await notificationApi.list(token,{filter,limit:PAGE_SIZE,offset:0});
      setItems(result.notifications);setTotal(result.total);setHasMore(result.hasMore);
      setUnreadCount(result.unreadCount);publishNotificationUnread(token,result.unreadCount);
      setError(null);
    }catch{setError(t("notifications.loadError"));}
    finally{setRefreshing(false);}
  }
  async function more(){
    if(!token||!hasMore||loadingMore||loading||busy)return;
    setLoadingMore(true);
    try{
      const result=await notificationApi.list(token,{filter,limit:PAGE_SIZE,offset:items.length});
      setItems(current=>{
        const ids=new Set(current.map(x=>x.id));
        return [...current,...result.notifications.filter(x=>!ids.has(x.id))];
      });
      setTotal(result.total);setHasMore(result.hasMore);
      setUnreadCount(result.unreadCount);publishNotificationUnread(token,result.unreadCount);
    }catch{setError(t("notifications.loadError"));}
    finally{setLoadingMore(false);}
  }
  function updateUnread(count:number){
    setUnreadCount(count);
    if(token)publishNotificationUnread(token,count);
  }
  async function markRead(item:NotificationDto){
    if(!token||item.readAt)return;
    try{
      const {notification}=await notificationApi.markRead(token,item.id);
      if(filter==="UNREAD"){setItems(prev=>prev.filter(x=>x.id!==item.id));setTotal(n=>Math.max(0,n-1));}
      else setItems(prev=>prev.map(x=>x.id===item.id?notification:x));
      updateUnread(Math.max(0,unreadCount-1));
    }catch{setError(t("notifications.actionError"));}
  }
  async function openItem(item:NotificationDto){
    if(!item.readAt)await markRead(item);
    target(item)();
  }
  async function markAll(){
    if(!token||busy||unreadCount===0)return;
    setBusy(true);setError(null);
    try{
      const result=await notificationApi.markAllRead(token);
      updateUnread(result.unreadCount);
      if(filter==="UNREAD"){setItems([]);setTotal(0);setHasMore(false);}
      else setItems(prev=>prev.map(x=>x.readAt?x:{...x,readAt:new Date().toISOString()}));
    }catch{setError(t("notifications.actionError"));}
    finally{setBusy(false);}
  }
  function remove(item:NotificationDto){
    if(!token||busy)return;
    Alert.alert(t("notifications.deleteOne"),t("notifications.confirmDeleteOne"),[
      {text:t("common.cancel"),style:"cancel"},
      {text:t("notifications.deleteOne"),style:"destructive",onPress:()=>void (async()=>{
        setBusy(true);setActionId(null);
        try{
          const result=await notificationApi.remove(token,item.id);
          setItems(prev=>prev.filter(x=>x.id!==item.id));
          setTotal(n=>Math.max(0,n-1));
          updateUnread(result.unreadCount);
        }catch{setError(t("notifications.actionError"));}
        finally{setBusy(false);}
      })()},
    ]);
  }
  function clearRead(){
    if(!token||busy||!items.some(x=>x.readAt)&&filter==="ALL"&&total===unreadCount)return;
    Alert.alert(t("notifications.clearRead"),t("notifications.confirmClearRead"),[
      {text:t("common.cancel"),style:"cancel"},
      {text:t("notifications.clearRead"),style:"destructive",onPress:()=>void (async()=>{
        setBusy(true);setActionId(null);
        try{
          const result=await notificationApi.clearRead(token);
          updateUnread(result.unreadCount);setRetry(n=>n+1);
        }catch{setError(t("notifications.actionError"));}
        finally{setBusy(false);}
      })()},
    ]);
  }
  function title(item:NotificationDto){
    return item.type==="SLOT_PROMOTION"||item.type==="VENUE_POST"||item.type==="COMPETITION_UPDATE"
      ?item.title:t(`notifications.type.${item.type}` as never);
  }
  function body(item:NotificationDto){
    if(item.type==="BOOKING_CONFIRMED"){
      const startsAt=typeof item.data.startsAt==="string"?item.data.startsAt:null;
      if(startsAt){
        const parts=formatLocalDateTimeParts(startsAt,language);
        const venue=typeof item.data.venueName==="string"
          ?item.data.venueName
          :item.body.split(" · ")[0]||"";
        return t("notifications.message.bookingConfirmed",{venue,date:parts.date,time:parts.time});
      }
    }
    if(item.type==="BOOKING_CANCELLED"&&typeof item.data.venueName==="string")
      return t("notifications.message.bookingCancelled",{venue:item.data.venueName});
    if(item.type==="TEAM_INVITATION"&&typeof item.data.teamName==="string")
      return t("notifications.message.teamInvitation",{team:item.data.teamName});
    if(item.type==="VENUE_POST"&&typeof item.data.venueName==="string")
      return t("notifications.message.venuePost",{venue:item.data.venueName});
    return item.body||t(`notifications.body.${item.type}` as never);
  }

  const shownGroups=useMemo(()=>{
    const now=new Date();
    const today=dayKey(now);
    const yesterday=dayKey(new Date(now.getTime()-86400000));
    const groups:Array<{label:string;items:NotificationDto[]}>=[];

    for(const item of items){
      const day=groupDay(item.createdAt);
      const label=day===today?t("notifications.today")
        :day===yesterday?t("notifications.yesterday"):t("notifications.earlier");
      const last=groups[groups.length-1];
      if(last?.label===label)last.items.push(item);
      else groups.push({label,items:[item]});
    }
    return groups;
  },[items,t]);

  return <Screen showHeader publicNav style={styles.page} refreshing={refreshing} onRefresh={()=>void refresh()}>
    <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={{flex:1,gap:4}}>
        <AppText variant="title" weight="bold">{t("notifications.title")}</AppText>
        <AppText variant="caption" muted>{t("notifications.subtitle")}</AppText>
      </View>
      <Pressable testID="notification-settings" accessibilityRole="button"
        accessibilityLabel={t("notifications.preferences")}
        onPress={()=>router.push("/notifications/preferences")}
        style={({pressed})=>[styles.settings,pressed&&styles.pressed]}>
        <Ionicons name="options-outline" color={colors.primary} size={22}/>
      </Pressable>
    </View>

    <View style={styles.summary}>
      <View style={[styles.summaryTop,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.summaryIcon}>
          <Ionicons name="notifications-outline" size={25} color={colors.primary}/>
        </View>
        <View style={styles.summaryCount}>
          <AppText weight="bold" variant="title" numberOfLines={1} style={styles.countNumber}>
            {unreadCount}
          </AppText>
          <AppText weight="semibold" variant="caption" numberOfLines={2}>
            {t("notifications.unread")}
          </AppText>
        </View>
      </View>
      <AppText variant="caption" muted style={styles.summaryDescription}>
        {t("notifications.inboxSummary")}
      </AppText>
      <Pressable testID="notification-mark-all" accessibilityRole="button"
        accessibilityLabel={t("notifications.markAllRead")}
        accessibilityState={{disabled:unreadCount===0||busy}}
        disabled={unreadCount===0||busy} onPress={()=>void markAll()}
        style={({pressed})=>[styles.allReadButton,{flexDirection:isRTL?"row-reverse":"row"},
          (unreadCount===0||busy)&&styles.allReadDisabled,
          pressed&&unreadCount>0&&!busy&&styles.pressed]}>
        <Ionicons name="checkmark-done-outline" size={19}
          color={unreadCount===0||busy?colors.textMuted:colors.primary}/>
        <AppText weight="semibold" variant="body" numberOfLines={2}
          style={[styles.allReadText,(unreadCount===0||busy)&&styles.allReadTextDisabled]}>
          {t("notifications.markAllRead")}
        </AppText>
      </Pressable>
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="notifications-filters"
      style={styles.filterScroll}
      contentContainerStyle={[styles.filters,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {FILTERS.map(value=><Pressable key={value} testID={`notification-filter-${value}`}
        accessibilityRole="tab" accessibilityLabel={t(`notifications.filter.${value}` as never)}
        accessibilityState={{selected:filter===value}}
        onPress={()=>{setActionId(null);setFilter(value);}}
        style={({pressed})=>[styles.chip,filter===value&&styles.chipActive,pressed&&styles.pressed]}>
        <Ionicons name={FILTER_ICONS[value]} size={17}
          color={filter===value?"#FFFFFF":colors.textMuted}/>
        <AppText weight="semibold" variant="caption" numberOfLines={1}
          style={filter===value?styles.chipLabelActive:styles.chipLabel}>
          {t(`notifications.filter.${value}` as never)}
        </AppText>
        {value==="UNREAD"&&unreadCount>0?<View style={styles.chipCount}>
          <AppText variant="caption" weight="bold" style={styles.chipCountText} numberOfLines={1}>
            {unreadCount>99?"99+":unreadCount}
          </AppText>
        </View>:null}
      </Pressable>)}
    </ScrollView>

    {!loading&&total>0?<View style={[styles.toolbar,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <AppText variant="caption" muted>{t("notifications.showingCount",{count:total})}</AppText>
      <Pressable testID="notification-clear-read" accessibilityRole="button"
        accessibilityLabel={t("notifications.clearRead")}
        onPress={clearRead}
        style={({pressed})=>[styles.clearReadButton,{flexDirection:isRTL?"row-reverse":"row"},
          pressed&&styles.pressed]}>
        <Ionicons name="trash-outline" size={16} color={colors.primary}/>
        <AppText weight="semibold" variant="caption" numberOfLines={2} style={styles.clearReadText}>
          {t("notifications.clearRead")}
        </AppText>
      </Pressable>
    </View>:null}

    {loading?<DataLoadingState variant="list" minHeight={450}/>:null}
    {error?<Card style={styles.error}>
      <Ionicons name="cloud-offline-outline" size={24} color={colors.danger}/>
      <AppText style={{color:colors.danger,flex:1}}>{error}</AppText>
      <Button label={t("common.retry")} variant="secondary" onPress={()=>setRetry(n=>n+1)}/>
    </Card>:null}
    {!loading&&!error&&items.length===0?<Card style={styles.empty}>
      <Ionicons name={filter==="UNREAD"?"checkmark-done-circle-outline":"notifications-off-outline"}
        color={colors.primary} size={42}/>
      <AppText weight="bold" variant="bodyLarge">
        {t(filter==="UNREAD"?"notifications.emptyUnread":"notifications.emptyFiltered")}
      </AppText>
      <AppText muted style={{textAlign:"center"}}>
        {t(filter==="UNREAD"?"notifications.emptyUnreadBody":"notifications.emptyHint")}
      </AppText>
      {filter!=="ALL"?<Button label={t("notifications.filter.ALL")} variant="secondary"
        onPress={()=>setFilter("ALL")}/>:null}
    </Card>:null}

    {!loading&&!error?shownGroups.map((group,index)=><View key={index} style={styles.group}>
      <View style={[styles.groupTitle,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <AppText weight="bold" variant="bodyLarge">{group.label}</AppText>
        <View style={styles.groupLine}/>
      </View>
      {group.items.map(item=><View key={item.id}
        testID={`notification-${item.id}`} style={[styles.item,!item.readAt&&styles.unreadItem]}>
        <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Pressable accessibilityRole="button" onPress={()=>void openItem(item)}
            accessibilityLabel={`${title(item)}. ${body(item)}`}
            style={[styles.itemPress,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <View style={[styles.typeIcon,{backgroundColor:!item.readAt?colors.primarySoft:colors.surfaceMuted}]}>
              <Ionicons name={ICONS[item.type]} size={23} color={colors.primary}/>
            </View>
            <View style={{flex:1,gap:4,minWidth:0}}>
              <View style={[styles.titleRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <AppText weight="bold" numberOfLines={2} style={{flex:1}}>{title(item)}</AppText>
                {!item.readAt?<View style={styles.dot}/>:null}
              </View>
              <AppText muted={Boolean(item.readAt)} numberOfLines={3}>{body(item)}</AppText>
              <AppText variant="caption" muted>
                {formatPostTimeAgo(item.createdAt,language)}
              </AppText>
            </View>
          </Pressable>
          <Pressable testID={`notification-actions-${item.id}`} accessibilityRole="button"
            accessibilityLabel={t("notifications.moreActions")}
            onPress={()=>setActionId(id=>id===item.id?null:item.id)}
            style={({pressed})=>[styles.moreIcon,actionId===item.id&&styles.moreIconActive,
              pressed&&styles.pressed]}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted}/>
          </Pressable>
        </View>
        {actionId===item.id?<View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
          {!item.readAt?<Button label={t("notifications.markRead")} variant="secondary"
            onPress={()=>{setActionId(null);void markRead(item);}} style={{flex:1}}/>:null}
          <Button label={t("notifications.deleteOne")} variant="danger"
            onPress={()=>remove(item)} disabled={busy} style={{flex:1}}/>
        </View>:null}
      </View>)}
    </View>):null}

    {!loading&&!error&&hasMore?<Button label={t("notifications.loadMore")}
      loading={loadingMore} disabled={busy} variant="secondary" onPress={()=>void more()}/>:null}
  </Screen>;
}

const styles=StyleSheet.create({
  page:{paddingTop:spacing.md,gap:spacing.md},
  heading:{alignItems:"center",gap:spacing.sm},
  settings:{width:48,height:48,borderWidth:1,borderColor:"#C5D7F6",borderRadius:radius.md,
    backgroundColor:colors.surface,alignItems:"center",justifyContent:"center"},
  summary:{backgroundColor:colors.surface,padding:spacing.md,alignItems:"stretch",
    borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,gap:spacing.sm},
  summaryTop:{alignItems:"center",gap:spacing.sm},
  summaryIcon:{width:48,height:48,backgroundColor:colors.primarySoft,borderRadius:24,
    alignItems:"center",justifyContent:"center"},
  summaryCount:{flex:1,minWidth:0,gap:0},
  countNumber:{fontSize:26,lineHeight:31,color:colors.text},
  summaryDescription:{lineHeight:20},
  allReadButton:{width:"100%",minHeight:46,paddingHorizontal:spacing.md,paddingVertical:spacing.sm,
    gap:spacing.sm,borderRadius:radius.md,borderWidth:1,borderColor:"#C5D7F6",
    backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"},
  allReadText:{color:colors.primary,textAlign:"center",flexShrink:1},
  allReadDisabled:{backgroundColor:colors.surfaceMuted,borderColor:colors.border},
  allReadTextDisabled:{color:colors.textMuted},
  filterScroll:{height:52,minHeight:52,maxHeight:52,flexGrow:0,flexShrink:0,alignSelf:"stretch"},
  filters:{gap:spacing.sm,paddingVertical:4,alignItems:"center"},
  chip:{height:44,minHeight:44,maxHeight:44,minWidth:72,flexShrink:0,flexGrow:0,
    alignItems:"center",justifyContent:"center",borderRadius:radius.pill,
    borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,
    paddingHorizontal:spacing.md,flexDirection:"row",gap:spacing.xs},
  chipActive:{backgroundColor:colors.primary,borderColor:colors.primary},
  chipLabel:{color:colors.text,flexShrink:0},
  chipLabelActive:{color:"#FFFFFF",flexShrink:0},
  chipCount:{minWidth:20,height:20,alignItems:"center",justifyContent:"center",
    borderRadius:10,backgroundColor:"#FFFFFF",paddingHorizontal:3},
  chipCountText:{color:colors.primary,fontSize:11},
  toolbar:{alignItems:"center",justifyContent:"space-between",gap:spacing.sm,minHeight:44},
  clearReadButton:{minHeight:44,maxWidth:"65%",alignItems:"center",justifyContent:"center",gap:5,
    paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,
    borderRadius:radius.md,borderWidth:1,borderColor:"#C5D7F6",
    backgroundColor:colors.surface},
  clearReadText:{color:colors.primary,textAlign:"center",flexShrink:1},
  error:{flexDirection:"row",alignItems:"center",gap:spacing.sm,flexWrap:"wrap"},
  empty:{minHeight:230,justifyContent:"center",alignItems:"center",gap:spacing.md,padding:spacing.lg},
  group:{gap:spacing.sm},
  groupTitle:{gap:spacing.md,alignItems:"center"},
  groupLine:{flex:1,height:1,backgroundColor:colors.border},
  item:{backgroundColor:colors.surface,borderRadius:radius.md,
    borderWidth:1,borderColor:colors.border,overflow:"hidden"},
  unreadItem:{borderColor:colors.primary,backgroundColor:"#F2F7FF"},
  row:{alignItems:"flex-start"},
  itemPress:{flex:1,minWidth:0,padding:spacing.md,gap:spacing.md,alignItems:"flex-start"},
  typeIcon:{width:44,height:44,borderRadius:22,alignItems:"center",justifyContent:"center"},
  titleRow:{alignItems:"center",gap:spacing.sm},
  dot:{width:8,height:8,borderRadius:4,backgroundColor:colors.primary},
  moreIcon:{width:44,height:44,marginTop:spacing.xs,marginRight:spacing.xs,
    borderRadius:radius.md,alignItems:"center",justifyContent:"center"},
  moreIconActive:{backgroundColor:colors.primarySoft},
  actions:{paddingHorizontal:spacing.md,paddingBottom:spacing.md,gap:spacing.sm},
  pressed:{opacity:.76},
});
