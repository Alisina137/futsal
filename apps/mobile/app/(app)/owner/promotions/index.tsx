import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {PromotionDto} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useMemo,useRef,useState} from "react";
import {AppState,Modal,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {ownerApi} from "../../../../src/lib/api";
import {ownerPromotionCounts,ownerPromotionsForView,ownerPromotionState,ownerPromotionViews,
  type OwnerPromotionView} from "../../../../src/lib/owner-media-marketing";
import {formatCompetitionDateTime} from "../../../../src/lib/date-time";
import {useVisibleTab} from "../../../../src/hooks/useVisibleTab";
import {AppText} from "../../../../src/components/ui/AppText";
import {Button} from "../../../../src/components/ui/Button";
import {Card} from "../../../../src/components/ui/Card";
import {DataLoadingState} from "../../../../src/components/ui/DataLoadingState";
import {Screen} from "../../../../src/components/ui/Screen";
import {TextField} from "../../../../src/components/ui/TextField";
import {useAuth} from "../../../../src/providers/AuthProvider";
import {useLocale} from "../../../../src/providers/LocaleProvider";

export default function OwnerPromotionsScreen(){
  const {session}=useAuth();
  const token=session?.accessToken;
  const {t,language,isRTL}=useLocale();
  const [items,setItems]=useState<PromotionDto[]>([]);
  const [loadedToken,setLoadedToken]=useState<string|null>(null);
  const [view,setView]=useState<OwnerPromotionView>("ALL");
  const nav=useVisibleTab<OwnerPromotionView>(view);
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [confirm,setConfirm]=useState<PromotionDto|null>(null);
  const [busyToken,setBusyToken]=useState<string|null>(null);
  const busy=busyToken===token;
  const [now,setNow]=useState(Date.now());
  const requestId=useRef(0);
  const activeToken=useRef(token);
  activeToken.current=token;
  const writing=useRef(false);
  const safeItems=loadedToken===token?items:[];

  const load=useCallback(async()=>{
    const request=++requestId.current;
    if(!token){setItems([]);setLoadedToken(null);setLoading(false);return;}
    setLoading(true);setError(null);
    try{
      const response=await ownerApi.promotions(token);
      if(request!==requestId.current)return;
      setItems(response.promotions);setLoadedToken(token);setNow(Date.now());
    }catch{
      if(request===requestId.current)setError(t("ownerMarketing.loadPromotionsError"));
    }finally{if(request===requestId.current)setLoading(false);}
  },[token,t]);

  useFocusEffect(useCallback(()=>{
    setConfirm(null);setView("ALL");setQuery("");
    void load();
    const timer=setInterval(()=>{
      if(AppState.currentState==="active")void load();
    },60_000);
    return()=>{requestId.current++;clearInterval(timer);};
  },[load]));

  const visible=useMemo(()=>ownerPromotionsForView(safeItems,view,now,query),
    [safeItems,view,now,query]);
  const counts=ownerPromotionCounts(safeItems,now);
  async function close(){
    const promotion=confirm;
    if(!token||!promotion||writing.current)return;
    writing.current=true;setBusyToken(token);setError(null);
    const actorToken=token;
    try{
      await ownerApi.closePromotion(actorToken,promotion.id);
      if(actorToken!==activeToken.current)return;
      setConfirm(null);
      await load();
    }catch{
      if(actorToken===activeToken.current)setError(t("ownerMarketing.closePromotionError"));
    }finally{writing.current=false;setBusyToken(current=>current===actorToken?null:current);}
  }

  if(loading&&loadedToken!==token)return <Screen embedded>
    <DataLoadingState variant="list" minHeight={460}/>
  </Screen>;

  return <Screen embedded refreshing={loading&&loadedToken===token} onRefresh={()=>void load()}>
    <View testID="owner-phase6-promotions" style={styles.heading}>
      <AppText variant="title" weight="bold">{t("ownerMarketing.promotionsTitle")}</AppText>
      <AppText variant="caption" muted>{t("owner.phase6.promoSubtitle")}</AppText>
      <Button label={t("ownerMarketing.createPromotion")} onPress={()=>router.push("/owner/promotions/create")}/>
    </View>

    <Card style={styles.stack}>
      <TextField label={t("owner.phase6.searchPromotions")}
        value={query} onChangeText={setQuery} maxLength={120}/>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        testID="owner-phase6-promotion-filters"
        ref={nav.scrollRef} onLayout={nav.onViewport} onContentSizeChange={nav.onContentSize}
        contentContainerStyle={[styles.tabs,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {ownerPromotionViews.map(key=><Pressable key={key}
          accessibilityRole="tab" accessibilityState={{selected:key===view}}
          accessibilityLabel={t(`owner.phase6.promotion.${key}` as never)}
          onLayout={event=>nav.cellLayout(key,event)}
          onPress={()=>{setView(key);nav.focus(key,true);}}
          style={[styles.chip,key===view&&styles.activeChip]}>
          <AppText variant="caption" weight="semibold"
            style={key===view?styles.activeLabel:undefined}>
            {t(`owner.phase6.promotion.${key}` as never)} ({counts[key]})
          </AppText>
        </Pressable>)}
      </ScrollView>
    </Card>

    {error?<Card style={styles.stack}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} variant="secondary" onPress={()=>void load()}/>
    </Card>:null}
    {!loading&&!error&&loadedToken===token&&visible.length===0?<Card>
      <AppText muted>{t("owner.phase6.noMatchingPromotions")}</AppText>
    </Card>:null}
    {visible.map(item=>{
      const state=ownerPromotionState(item,now);
      return <Card key={item.id} testID={`owner-phase6-promotion-${item.id}`}
        style={styles.promotion}>
        <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.icon}><Ionicons name="pricetag-outline" color={colors.primary} size={22}/></View>
          <View style={{flex:1,gap:3}}>
            <AppText variant="bodyLarge" weight="bold">{item.title}</AppText>
            <AppText variant="caption" muted>{item.areaName}</AppText>
          </View>
          <View style={styles.badge}><AppText variant="caption" weight="bold" style={{color:colors.primary}}>
            {t(`owner.phase6.promotion.${state}` as never)}
          </AppText></View>
        </View>
        <AppText variant="caption" muted>{t("owner.phase6.starts")}: {formatCompetitionDateTime(item.startsAt,language)}</AppText>
        <AppText variant="caption" muted>{t("owner.phase6.ends")}: {formatCompetitionDateTime(item.endsAt,language)}</AppText>
        <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <AppText variant="bodyLarge" weight="bold" style={{color:colors.primary}}>
            {new Intl.NumberFormat(language).format(item.discountedPriceAfn)} AFN
          </AppText>
          <AppText variant="caption" muted style={{textDecorationLine:"line-through"}}>
            {new Intl.NumberFormat(language).format(item.originalPriceAfn)} AFN
          </AppText>
          <AppText variant="caption" weight="semibold">{item.discountPercent}%</AppText>
        </View>
        {item.note?<AppText variant="caption">{item.note}</AppText>:null}
        {item.closeReason?<AppText variant="caption" muted>{item.closeReason}</AppText>:null}
        {item.status==="ACTIVE"?<Button label={t("ownerMarketing.closePromotion")}
          variant="secondary" disabled={busy} onPress={()=>setConfirm(item)}/>:null}
      </Card>;
    })}

    <Modal transparent visible={confirm!==null&&loadedToken===token} animationType="fade"
      onRequestClose={()=>{if(!busy)setConfirm(null);}}>
      <View style={styles.overlay}><Card style={styles.dialog}>
        <AppText variant="bodyLarge" weight="bold">{t("owner.phase6.closeTitle")}</AppText>
        <AppText>{t("owner.phase6.closeMessage")}</AppText>
        {confirm?<AppText weight="semibold">{confirm.title}</AppText>:null}
        <Button label={t("ownerMarketing.closePromotion")} variant="danger"
          loading={busy} onPress={()=>void close()}/>
        <Button label={t("common.cancel")} variant="secondary"
          disabled={busy} onPress={()=>setConfirm(null)}/>
      </Card></View>
    </Modal>
  </Screen>;
}
const styles=StyleSheet.create({
  heading:{gap:spacing.sm},stack:{gap:spacing.md},promotion:{gap:spacing.md},
  row:{gap:spacing.sm,alignItems:"center",flexWrap:"wrap"},
  tabs:{flexGrow:1,gap:spacing.sm,alignItems:"center",paddingVertical:spacing.xs},
  chip:{minHeight:44,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,
    paddingHorizontal:spacing.md,justifyContent:"center",backgroundColor:colors.surface},
  activeChip:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  activeLabel:{color:colors.primary},
  icon:{height:40,width:40,justifyContent:"center",alignItems:"center",
    borderRadius:radius.md,backgroundColor:colors.primarySoft},
  badge:{borderRadius:radius.pill,backgroundColor:colors.primarySoft,padding:spacing.xs},
  overlay:{flex:1,padding:spacing.lg,justifyContent:"center",backgroundColor:"#00000066"},
  dialog:{width:"100%",maxWidth:480,alignSelf:"center",gap:spacing.md},
});
