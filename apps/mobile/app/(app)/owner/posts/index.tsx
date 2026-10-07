import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { VenuePostDto, VenuePostVisibility } from "@leaguekick/contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import { ownerApi } from "../../../../src/lib/api";
import { formatLocalDateTimeParts } from "../../../../src/lib/date-time";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { DataLoadingState } from "../../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../../src/components/ui/Screen";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

type Filter="ALL"|"PUBLISHED"|"DRAFT"|"SCHEDULED"|"PRIVATE";

function isPendingSchedule(post:VenuePostDto){
  return post.schedules.some((item)=>!item.executedAt&&!item.cancelledAt);
}

export default function OwnerPostsScreen(){
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const [items,setItems]=useState<VenuePostDto[]>([]);
  const [venueId,setVenueId]=useState<string|null>(null);
  const [filter,setFilter]=useState<Filter>("ALL");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!session)return;
    setLoading(true);setError(null);
    try{
      const [posts,status]=await Promise.all([
        ownerApi.posts(session.accessToken),
        ownerApi.getStatus(session.accessToken),
      ]);
      setItems(posts.posts);
      setVenueId(status.venue?.id??null);
    }catch{
      setError(t("media.loadError"));
    }finally{setLoading(false);}
  },[session,t]);

  useFocusEffect(useCallback(()=>{void load();},[load]));

  const visible=useMemo(()=>items.filter((item)=>{
    if(filter==="ALL")return true;
    if(filter==="PUBLISHED")return item.status==="PUBLISHED"&&item.visibility!=="PRIVATE";
    if(filter==="DRAFT")return item.status==="UNPUBLISHED"&&!isPendingSchedule(item);
    if(filter==="SCHEDULED")return isPendingSchedule(item);
    return item.visibility==="PRIVATE";
  }),[filter,items]);

  const stats=useMemo(()=>({
    total:items.length,
    published:items.filter((item)=>item.status==="PUBLISHED"&&item.visibility!=="PRIVATE").length,
    scheduled:items.filter(isPendingSchedule).length,
    private:items.filter((item)=>item.visibility==="PRIVATE").length,
  }),[items]);

  async function toggle(item:VenuePostDto){
    if(!session||busy)return;
    setBusy(item.id);setError(null);
    try{
      if(item.status==="PUBLISHED")await ownerApi.unpublishPost(session.accessToken,item.id);
      else await ownerApi.publishPost(session.accessToken,item.id);
      await load();
    }catch{setError(t("media.statusError"));}
    finally{setBusy(null);}
  }

  async function setVisibility(item:VenuePostDto,visibility:VenuePostVisibility){
    if(!session||busy||item.visibility===visibility)return;
    setBusy(item.id);setError(null);
    try{
      await ownerApi.setPostVisibility(session.accessToken,item.id,visibility);
      await load();
    }catch{setError(t("media.visibilityError"));}
    finally{setBusy(null);}
  }

  async function remove(item:VenuePostDto){
    if(!session||busy)return;
    setBusy(item.id);setError(null);
    try{
      await ownerApi.deletePost(session.accessToken,item.id);
      setItems((current)=>current.filter((value)=>value.id!==item.id));
    }catch{setError(t("media.deleteError"));}
    finally{setBusy(null);}
  }

  function confirmDelete(item:VenuePostDto){
    Alert.alert(
      t("media.deleteTitle"),
      t("media.deleteBody"),
      [
        {text:t("common.cancel"),style:"cancel"},
        {text:t("media.delete"),style:"destructive",onPress:()=>void remove(item)},
      ],
    );
  }

  async function cancelSchedule(item:VenuePostDto,scheduleId:string){
    if(!session||busy)return;
    setBusy(item.id);setError(null);
    try{
      await ownerApi.cancelPostSchedule(session.accessToken,item.id,scheduleId);
      await load();
    }catch{setError(t("media.scheduleCancelError"));}
    finally{setBusy(null);}
  }

  if(loading)return <Screen embedded><DataLoadingState variant="dashboard" minHeight={520}/></Screen>;

  return <Screen embedded>
    <View style={[styles.hero,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={styles.heroIcon}><Ionicons name="megaphone-outline" size={28} color={colors.primary}/></View>
      <View style={{flex:1,gap:3}}>
        <AppText variant="title" weight="bold">{t("media.title")}</AppText>
        <AppText muted>{t("media.subtitle")}</AppText>
      </View>
    </View>

    <View style={styles.statGrid}>
      <Stat label={t("media.stat.total")} value={stats.total}/>
      <Stat label={t("media.stat.public")} value={stats.published}/>
      <Stat label={t("media.stat.scheduled")} value={stats.scheduled}/>
      <Stat label={t("media.stat.private")} value={stats.private}/>
    </View>

    <View style={[styles.primaryActions,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Button label={t("media.createPost")} onPress={()=>router.push("/owner/posts/create")} style={{flex:1}}/>
      {venueId?<Button
        label={t("media.viewPage")}
        onPress={()=>router.push({pathname:"/venues/[venueId]",params:{venueId}})}
        variant="secondary"
        style={{flex:1}}
      />:null}
    </View>

    <View style={[styles.filters,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {(["ALL","PUBLISHED","DRAFT","SCHEDULED","PRIVATE"] as const).map((value)=><Pressable
        key={value}
        onPress={()=>setFilter(value)}
        style={[styles.filterChip,filter===value&&styles.filterChipActive]}
      >
        <AppText variant="caption" weight={filter===value?"bold":"semibold"} style={filter===value?styles.filterTextActive:undefined}>
          {t(`media.filter.${value}` as never)}
        </AppText>
      </Pressable>)}
    </View>

    {error?<Card style={styles.errorCard}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} onPress={()=>void load()} variant="secondary"/>
    </Card>:null}

    {!visible.length?<Card style={styles.emptyCard}>
      <Ionicons name="images-outline" size={30} color={colors.primary}/>
      <AppText weight="bold">{t("media.emptyTitle")}</AppText>
      <AppText muted>{t("media.emptyBody")}</AppText>
    </Card>:null}

    {visible.map((item)=><MediaPostCard
      key={item.id}
      item={item}
      busy={busy===item.id}
      language={language}
      isRTL={isRTL}
      t={t}
      onToggle={()=>void toggle(item)}
      onVisibility={(visibility)=>void setVisibility(item,visibility)}
      onEdit={()=>router.push({pathname:"/owner/posts/create",params:{postId:item.id}})}
      onDelete={()=>confirmDelete(item)}
      onCancelSchedule={(scheduleId)=>void cancelSchedule(item,scheduleId)}
    />)}
  </Screen>;
}

function Stat({label,value}:{label:string;value:number}){
  return <Card style={styles.statCard}>
    <AppText variant="title" weight="bold" style={{color:colors.primary}}>{value}</AppText>
    <AppText variant="caption" muted style={{textAlign:"center"}}>{label}</AppText>
  </Card>;
}

function MediaPostCard({
  item,busy,language,isRTL,t,onToggle,onVisibility,onEdit,onDelete,onCancelSchedule,
}:{
  item:VenuePostDto;
  busy:boolean;
  language:Parameters<typeof formatLocalDateTimeParts>[1];
  isRTL:boolean;
  t:(key:any,params?:Record<string,string|number>)=>string;
  onToggle:()=>void;
  onVisibility:(value:VenuePostVisibility)=>void;
  onEdit:()=>void;
  onDelete:()=>void;
  onCancelSchedule:(id:string)=>void;
}){
  const published=formatLocalDateTimeParts(item.publishedAt,language);
  const pending=item.schedules.filter((schedule)=>!schedule.executedAt&&!schedule.cancelledAt);

  return <Card style={styles.postCard}>
    <View style={[styles.postHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={[styles.typeBadge]}>
        <AppText variant="caption" weight="bold" style={{color:colors.primary}}>
          {t(`media.type.${item.postType}` as never)}
        </AppText>
      </View>
      <View style={{flex:1}}/>
      <AppText variant="caption" muted>{t(`media.visibility.${item.visibility}` as never)}</AppText>
    </View>

    {item.imageUrl?<Image source={{uri:item.imageUrl}} style={styles.postImage} resizeMode="cover"/>:null}
    <AppText>{item.body}</AppText>

    <View style={[styles.metaRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <AppText variant="caption" muted>{published.date}</AppText>
      <AppText variant="caption" muted>{published.time}</AppText>
      <AppText variant="caption" weight="semibold" style={{color:item.status==="PUBLISHED"?colors.success:colors.warning}}>
        {item.status==="PUBLISHED"?t("media.published"):t("media.unpublished")}
      </AppText>
    </View>

    <View style={styles.sectionDivider}/>

    <AppText variant="caption" weight="bold">{t("media.audience")}</AppText>
    <View style={[styles.visibilityRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {(["PUBLIC","FOLLOWERS","PRIVATE"] as const).map((value)=><Pressable
        key={value}
        disabled={busy}
        onPress={()=>onVisibility(value)}
        style={[styles.visibilityChip,item.visibility===value&&styles.visibilityChipActive]}
      >
        <Ionicons
          name={value==="PUBLIC"?"earth-outline":value==="FOLLOWERS"?"people-outline":"lock-closed-outline"}
          size={16}
          color={item.visibility===value?colors.primary:colors.textMuted}
        />
        <AppText variant="caption" weight="semibold">{t(`media.visibility.${value}` as never)}</AppText>
      </Pressable>)}
    </View>

    {pending.length?<View style={styles.automationBox}>
      <AppText variant="caption" weight="bold">{t("media.pendingAutomation")}</AppText>
      {pending.map((schedule)=>{
        const time=formatLocalDateTimeParts(schedule.executeAt,language);
        return <View key={schedule.id} style={[styles.scheduleRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={{flex:1,gap:2}}>
            <AppText variant="caption" weight="semibold">{t(`media.action.${schedule.action}` as never)}</AppText>
            <AppText variant="caption" muted>{time.date} · {time.time}</AppText>
          </View>
          <Pressable disabled={busy} onPress={()=>onCancelSchedule(schedule.id)}>
            <AppText variant="caption" weight="bold" style={{color:colors.danger}}>{t("common.cancel")}</AppText>
          </Pressable>
        </View>;
      })}
    </View>:null}

    <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Button
        label={item.status==="PUBLISHED"?t("media.unpublish"):t("media.publish")}
        onPress={onToggle}
        loading={busy}
        variant="secondary"
        style={styles.actionButton}
      />
      <Button label={t("media.edit")} onPress={onEdit} variant="secondary" style={styles.actionButton}/>
      <Button label={t("media.delete")} onPress={onDelete} variant="danger" style={styles.actionButton}/>
    </View>
  </Card>;
}

const styles=StyleSheet.create({
  hero:{alignItems:"center",gap:spacing.md},
  heroIcon:{width:52,height:52,borderRadius:16,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  statGrid:{flexDirection:"row",gap:spacing.xs,flexWrap:"wrap"},
  statCard:{minWidth:"23%",flexGrow:1,alignItems:"center",gap:2,padding:spacing.sm},
  primaryActions:{gap:spacing.sm},
  filters:{gap:spacing.xs,flexWrap:"wrap"},
  filterChip:{paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},
  filterChipActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  filterTextActive:{color:colors.primary},
  errorCard:{borderColor:colors.danger},
  emptyCard:{alignItems:"center",gap:spacing.sm,padding:spacing.lg},
  postCard:{gap:spacing.md},
  postHeader:{alignItems:"center",gap:spacing.sm},
  typeBadge:{paddingHorizontal:spacing.sm,paddingVertical:4,borderRadius:radius.pill,backgroundColor:colors.primarySoft},
  postImage:{width:"100%",height:210,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
  metaRow:{gap:spacing.sm,alignItems:"center",flexWrap:"wrap"},
  sectionDivider:{height:1,backgroundColor:colors.border},
  visibilityRow:{gap:spacing.xs,flexWrap:"wrap"},
  visibilityChip:{minHeight:38,paddingHorizontal:spacing.sm,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,flexDirection:"row",alignItems:"center",gap:spacing.xs},
  visibilityChipActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  automationBox:{gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
  scheduleRow:{alignItems:"center",gap:spacing.sm,paddingTop:spacing.xs},
  actions:{gap:spacing.sm,flexWrap:"wrap"},
  actionButton:{flexGrow:1,minWidth:100},
});
