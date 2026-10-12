import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {AvailabilitySlotDto,PublicVenueDto} from "@leaguekick/contracts";
import {router} from "expo-router";
import {useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,View} from "react-native";
import {venueApi} from "../../lib/api";
import {formatAppClock} from "../../lib/clock-display";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";

type Props={
  venue:Pick<PublicVenueDto,"id"|"name"|"timezone">;
  date:string;
  slots:AvailabilitySlotDto[];
  availableCount:number;
  snapshotAt?:string|undefined;
  onRefresh:()=>void;
  onSeeAll:()=>void;
};

/** Chips reflect the SAME venue/date/price/time filters as the directory count.
 * A tap verifies live inventory by exact court+start+end before opening confirm.
 * A chip never performs a booking or trusts a cached public search snapshot. */
export function VenueSlotShortcuts({venue,date,slots,availableCount,snapshotAt,onRefresh,onSeeAll}:Props){
  const {t,language,isRTL}=useLocale();
  const tr=(key:string,params?:Record<string,string|number>)=>
    t(("booking.preview."+key) as never,params);
  const [checking,setChecking]=useState<string|null>(null);
  const [error,setError]=useState<"taken"|"connection"|null>(null);
  const [unavailable,setUnavailable]=useState<string|null>(null);
  const running=useRef(false);
  const active=useRef(true);
  const epoch=useRef(0);
  useEffect(()=>{
    active.current=true;
    return()=>{active.current=false;epoch.current++;};
  },[]);
  // New search snapshots invalidate previous stale-slot warnings and async taps.
  useEffect(()=>{
    epoch.current++;
    running.current=false;
    setChecking(null);setError(null);setUnavailable(null);
  },[date,snapshotAt,venue.id]);
  const locale=language==="en"?"en-GB":language;
  const readableDate=new Intl.DateTimeFormat(locale,{timeZone:"UTC",calendar:"gregory",
    weekday:"short",day:"numeric",month:"short"}).format(new Date(date+"T12:00:00Z"));
  const keyFor=(slot:AvailabilitySlotDto)=>slot.areaId+"-"+slot.startsAt;
  async function checkAndContinue(slot:AvailabilitySlotDto){
    const key=keyFor(slot);
    if(running.current||unavailable===key)return;
    running.current=true;
    const attempt=++epoch.current;
    setChecking(key);setError(null);
    try{
      const fresh=await venueApi.availabilityLive(venue.id,date);
      if(!active.current||epoch.current!==attempt)return;
      if(fresh.venue.id!==venue.id||fresh.date!==date||!fresh.live)throw Error("Mismatch");
      const match=fresh.slots.find(candidate=>
        candidate.areaId===slot.areaId&&candidate.startsAt===slot.startsAt&&
        candidate.endsAt===slot.endsAt&&candidate.venueId===venue.id);
      if(!match){
        setUnavailable(key);setError("taken");
        return;
      }
      // Confirmation itself independently revalidates occupancy/price.
      // Even a recently changed price is shown as a quote, not charged here.
      router.push({pathname:"/booking/confirm",params:{
        venueId:venue.id,areaId:match.areaId,venueName:venue.name,
        startsAt:match.startsAt,endsAt:match.endsAt,
        priceAfn:String(match.priceAfn),timeZone:venue.timezone,
      }});
    }catch{
      if(active.current&&epoch.current===attempt)setError("connection");
    }finally{
      if(active.current&&epoch.current===attempt){
        setChecking(null);running.current=false;
      }
    }
  }
  if(!availableCount||slots.length===0)return <View testID="venue-preview-empty"
      style={styles.empty}>
      <Ionicons name="time-outline" size={15} color={colors.textMuted}/>
      <AppText variant="caption" muted>{tr("none")}</AppText>
      <Pressable accessibilityRole="button" onPress={onSeeAll}>
        <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
          {tr("seeAll")}
        </AppText>
      </Pressable>
    </View>;
  return <View testID="venue-slot-previews" style={styles.frame}>
    <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Ionicons name="calendar-outline" size={15} color={colors.primary}/>
      <AppText variant="caption" weight="semibold" style={{flex:1}}>{tr("title")}</AppText>
      <AppText variant="caption" muted>{readableDate}</AppText>
    </View>
    <View style={[styles.chips,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {slots.slice(0,3).map(slot=>{
        const key=keyFor(slot),busy=checking===key,blocked=unavailable===key;
        return <Pressable key={key} testID={"venue-preview-slot-"+key}
          accessibilityRole="button"
          accessibilityLabel={formatAppClock(slot.startsAt,venue.timezone)+", "+
            slot.priceAfn+" AFN"}
          accessibilityHint={tr("tapHint")}
          accessibilityState={{busy,disabled:blocked||checking!==null}}
          disabled={blocked||checking!==null}
          onPress={()=>void checkAndContinue(slot)}
          style={({pressed})=>[styles.chip,blocked&&styles.disabled,pressed&&styles.pressed]}>
          {busy?<ActivityIndicator size="small" color={colors.primary}/>:
            <Ionicons name={slot.promotionId?"pricetag-outline":"time-outline"}
              size={15} color={colors.primary}/>}
          <AppText weight="bold" variant="caption" forceLtr
            numberOfLines={1} style={styles.time}>
            {formatAppClock(slot.startsAt,venue.timezone)}
          </AppText>
          <AppText weight="medium" variant="caption" forceLtr
            numberOfLines={1} style={styles.price}>{slot.priceAfn} AFN</AppText>
        </Pressable>;
      })}
    </View>
    <View style={[styles.footer,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <AppText variant="caption" muted style={{flex:1}}>{tr("verifyNote")}</AppText>
      <Pressable testID="venue-preview-see-all" accessibilityRole="button"
        accessibilityLabel={tr("seeAll")} onPress={onSeeAll}>
        <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
          {tr("seeAll")}
        </AppText>
      </Pressable>
    </View>
    {error?<View style={[styles.errorRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Ionicons name="alert-circle-outline" size={16} color={colors.danger}/>
      <AppText variant="caption" accessibilityLiveRegion="polite"
        style={{color:colors.danger,flex:1}}>{tr(error)}</AppText>
      <Pressable accessibilityRole="button" onPress={onRefresh} testID="venue-preview-refresh">
        <AppText variant="caption" weight="bold" style={{color:colors.primary}}>
          {t("common.retry")}
        </AppText>
      </Pressable>
    </View>:null}
  </View>;
}
const styles=StyleSheet.create({
  frame:{gap:spacing.sm,padding:spacing.sm,backgroundColor:colors.surfaceMuted,
    borderRadius:radius.md},
  heading:{gap:5,alignItems:"center"},
  chips:{flexWrap:"wrap",gap:6,alignItems:"stretch"},
  chip:{minWidth:82,flexBasis:"29%",flexGrow:1,minHeight:65,
    borderWidth:1,borderRadius:radius.sm,borderColor:colors.primary,
    backgroundColor:colors.surface,alignItems:"center",justifyContent:"center",
    paddingHorizontal:3,paddingVertical:5,gap:2},
  disabled:{opacity:0.45},
  pressed:{backgroundColor:colors.primarySoft},
  time:{fontSize:11,lineHeight:16,color:colors.primary,textAlign:"center"},
  price:{fontSize:10,lineHeight:15,textAlign:"center"},
  footer:{gap:spacing.sm,alignItems:"center"},
  errorRow:{gap:spacing.xs,alignItems:"center"},
  empty:{flexDirection:"row",flexWrap:"wrap",alignItems:"center",gap:spacing.xs,
    paddingHorizontal:spacing.sm,paddingVertical:spacing.xs},
});
