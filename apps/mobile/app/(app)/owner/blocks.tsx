import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {VenueCalendarEvent} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useRef,useState} from "react";
import {AppState,Modal,Pressable,StyleSheet,View} from "react-native";
import {ApiRequestError,ownerApi} from "../../../src/lib/api";
import {addDays,formatCalendarDate,formatCalendarTime,todayKabul} from "../../../src/lib/timetable-calendar";
import {ownerBlockedEvents} from "../../../src/lib/owner-schedule-management";
import {AppText} from "../../../src/components/ui/AppText";
import {Button} from "../../../src/components/ui/Button";
import {Card} from "../../../src/components/ui/Card";
import {DataLoadingState} from "../../../src/components/ui/DataLoadingState";
import {Screen} from "../../../src/components/ui/Screen";
import {useAuth} from "../../../src/providers/AuthProvider";
import {useLocale} from "../../../src/providers/LocaleProvider";

const WINDOW_DAYS=30;
type BlockItem={day:string;event:VenueCalendarEvent};

/** A bounded inventory view built from the existing owner-private timetable
 * endpoint, not a client-side scrape of months of bookings. */
export default function OwnerBlockedTimesScreen(){
  const {session}=useAuth();
  const token=session?.accessToken;
  const {t,isRTL,language}=useLocale();
  const [windowStart,setWindowStart]=useState(todayKabul);
  const [items,setItems]=useState<BlockItem[]>([]);
  const [loadedKey,setLoadedKey]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [confirm,setConfirm]=useState<BlockItem|null>(null);
  const [busy,setBusy]=useState(false);
  const generation=useRef(0);
  const writeLock=useRef(false);
  const windowEnd=addDays(windowStart,WINDOW_DAYS-1);
  const windowKey=`${token??""}:${windowStart}:${windowEnd}`;
  const visible=loadedKey===windowKey?items:[];
  const hasData=loadedKey===windowKey;

  const load=useCallback(async()=>{
    const id=++generation.current;
    if(!token){setLoadedKey(null);setItems([]);setLoading(false);return;}
    setLoading(true);setError(null);
    try{
      const result=await ownerApi.timetableCalendar(token,windowStart,windowEnd,null);
      if(id!==generation.current)return;
      setItems(ownerBlockedEvents(result.days));
      setLoadedKey(windowKey);
    }catch{
      if(id===generation.current)setError(t("owner.phase4.blocksLoadError"));
    }finally{if(id===generation.current)setLoading(false);}
  },[token,windowStart,windowEnd,windowKey,t]);

  useFocusEffect(useCallback(()=>{
    void load();
    const timer=setInterval(()=>{
      if(AppState.currentState==="active")void load();
    },60_000);
    return()=>{generation.current++;clearInterval(timer);};
  },[load]));

  const edit=(item:BlockItem)=>{
    const {event,day}=item;
    if(!event.startsAt||!event.endsAt)return;
    const hour=new Intl.DateTimeFormat("en-GB",{
      hour:"2-digit",minute:"2-digit",hourCycle:"h23",timeZone:"Asia/Kabul",
    });
    router.push({pathname:"/owner/block-time",params:{
      blockId:event.id,areaId:event.areaId??"",date:day,
      start:hour.format(new Date(event.startsAt)),
      end:hour.format(new Date(event.endsAt)),
      reason:event.title,returnTo:"blocks",
    }});
  };

  const create=()=>{
    router.push({pathname:"/owner/block-time",params:{
      date:windowStart,returnTo:"blocks",
    }});
  };
  async function remove(){
    const item=confirm;
    if(!item||!token||writeLock.current)return;
    writeLock.current=true;setBusy(true);setError(null);
    const id=++generation.current;
    try{
      await ownerApi.deleteBlock(token,item.event.id);
      if(id!==generation.current)return;
      setConfirm(null);
      await load();
    }catch(cause){
      if(id!==generation.current)return;
      setError(cause instanceof ApiRequestError&&cause.code==="SLOT_UNAVAILABLE"
        ?t("schedule.conflict"):t("owner.phase4.unblockError"));
      setConfirm(null);
      // Keep the error visible; retry refreshes and reconciles the state.
    }finally{
      writeLock.current=false;setBusy(false);
    }
  }

  return <Screen embedded refreshing={loading&&hasData} onRefresh={()=>void load()}>
    <View testID="owner-phase4-blocked-times" style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={styles.icon}><Ionicons name="ban-outline" size={25} color={colors.primary}/></View>
      <View style={{flex:1,gap:4}}>
        <AppText variant="title" weight="bold">{t("schedule.subnav.blocks")}</AppText>
        <AppText variant="caption" muted>{t("owner.phase4.blocksSubtitle")}</AppText>
      </View>
    </View>

    <Card style={styles.stack}>
      <AppText variant="caption" weight="semibold">{t("owner.phase4.dateWindow")}</AppText>
      <AppText weight="bold">
        {formatCalendarDate(windowStart,language)} – {formatCalendarDate(windowEnd,language)}
      </AppText>
      <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Button style={styles.half} label={t("schedule.previous")} variant="secondary"
          onPress={()=>setWindowStart(value=>addDays(value,-WINDOW_DAYS))}/>
        <Button style={styles.half} label={t("schedule.next")} variant="secondary"
          onPress={()=>setWindowStart(value=>addDays(value,WINDOW_DAYS))}/>
      </View>
      <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Button style={styles.half} label={t("schedule.today")} variant="ghost"
          onPress={()=>setWindowStart(todayKabul())}/>
        <Button style={styles.half} label={t("owner.phase4.addBlock")} onPress={create}/>
      </View>
    </Card>

    {error?<Card style={styles.stack}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} variant="secondary" onPress={()=>void load()}/>
    </Card>:null}

    {loading&&!hasData?<DataLoadingState variant="list" minHeight={300}/>:null}
    {!loading&&!error&&hasData&&!visible.length?<Card>
      <AppText muted>{t("owner.phase4.noBlocks")}</AppText>
    </Card>:null}
    {visible.map(item=>{
      const {event,day}=item;
      return <Card key={event.id} testID={`owner-phase4-block-${event.id}`} style={styles.block}>
        <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="lock-closed-outline" size={21} color={colors.primary}/>
          <View style={{flex:1,gap:2}}>
            <AppText weight="bold">{event.areaName}</AppText>
            <AppText variant="caption" muted>{formatCalendarDate(day,language,{weekday:"long",month:"short",day:"numeric"})}</AppText>
          </View>
        </View>
        <AppText weight="semibold" forceLtr>
          {event.startsAt?formatCalendarTime(event.startsAt,language):"—"} – {event.endsAt?formatCalendarTime(event.endsAt,language):"—"}
        </AppText>
        {event.title?<AppText variant="caption" muted>{event.title}</AppText>:null}
        <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Button style={styles.half} label={t("schedule.editBlock")} variant="secondary"
            onPress={()=>edit(item)} disabled={busy}/>
          <Button style={styles.half} label={t("schedule.unblock")} variant="danger"
            onPress={()=>setConfirm(item)} disabled={busy}/>
        </View>
      </Card>;
    })}

    <Modal visible={confirm!==null} transparent animationType="fade"
      onRequestClose={()=>{if(!busy)setConfirm(null);}}>
      <View style={styles.overlay}>
        <Card style={styles.dialog}>
          <AppText weight="bold" variant="bodyLarge">{t("owner.phase4.unblockTitle")}</AppText>
          <AppText>{t("owner.phase4.unblockConfirm")}</AppText>
          {confirm?<AppText variant="caption" muted>{confirm.event.areaName} · {formatCalendarDate(confirm.day,language)}</AppText>:null}
          <Button label={t("schedule.unblock")} variant="danger"
            loading={busy} onPress={()=>void remove()}/>
          <Button label={t("common.cancel")} variant="secondary"
            disabled={busy} onPress={()=>setConfirm(null)}/>
        </Card>
      </View>
    </Modal>
  </Screen>;
}

const styles=StyleSheet.create({
  stack:{gap:spacing.md},
  row:{gap:spacing.sm,alignItems:"center"},
  icon:{width:46,height:46,backgroundColor:colors.primarySoft,
    borderRadius:radius.md,justifyContent:"center",alignItems:"center"},
  half:{flex:1},
  block:{gap:spacing.md},
  overlay:{flex:1,padding:spacing.lg,justifyContent:"center",backgroundColor:"#00000066"},
  dialog:{width:"100%",maxWidth:500,alignSelf:"center",gap:spacing.md},
});
