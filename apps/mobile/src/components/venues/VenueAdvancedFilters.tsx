import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {VenueDirectorySort} from "@leaguekick/contracts";
import {useState} from "react";
import {Modal,Pressable,ScrollView,StyleSheet,TextInput,View} from "react-native";
import {useLocale} from "../../providers/LocaleProvider";
import {formatClock12From24Hour} from "../../lib/clock-display";
import {TimeOfDayPickerField} from "../ui/TimeOfDayPickerField";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";

export type VenuePeriod="any"|"morning"|"afternoon"|"evening"|"custom";
export type VenueFilterDraft={
  date:string;period:VenuePeriod;startTime:string;endTime:string;
  availableOnly:boolean;minPrice:string;maxPrice:string;sort:VenueDirectorySort;
};
export const venueToday=()=>{
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kabul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const row=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return row.year+"-"+row.month+"-"+row.day;
};
export const venueDateAdd=(date:string,n:number)=>
  new Date(Date.parse(date+"T12:00:00Z")+n*86400000).toISOString().slice(0,10);
export const newVenueFilters=():VenueFilterDraft=>({
  date:venueToday(),period:"any",startTime:"06:00",endTime:"23:00",
  availableOnly:false,minPrice:"",maxPrice:"",sort:"recommended",
});
const sortOptions:VenueDirectorySort[]=["recommended","nearest","lowestPrice","mostFollowed","availableSoonest"];
const periods:VenuePeriod[]=["any","morning","afternoon","evening","custom"];
const localeOf=(language:string)=>language==="en"?"en-GB":language;
const displayDate=(date:string,language:string)=>
  new Intl.DateTimeFormat(localeOf(language),{timeZone:"UTC",calendar:"gregory",weekday:"short",day:"numeric",month:"short",year:"numeric"})
    .format(new Date(date+"T12:00:00Z"));

type Props={
  value:VenueFilterDraft;onChange:(draft:VenueFilterDraft)=>void;
  hasSavedLocation:boolean;error:string|null;
};
export function VenueAdvancedFilters({value,onChange,hasSavedLocation,error}:Props){
  const {t,isRTL,language}=useLocale();
  const tr=(key:string)=>t(("booking.filter."+key) as never);
  const [advanced,setAdvanced]=useState(false);
  const [datePickerOpen,setDatePickerOpen]=useState(false);
  const [calendarMonth,setCalendarMonth]=useState(value.date.slice(0,7));
  const today=venueToday(),limit=venueDateAdd(today,60);
  const locale=localeOf(language);
  function set<K extends keyof VenueFilterDraft>(key:K,next:VenueFilterDraft[K]){
    onChange({...value,[key]:next});
  }
  function chooseDate(date:string){
    if(date<today||date>limit)return;
    set("date",date);setDatePickerOpen(false);
  }
  function openCalendar(){
    setCalendarMonth(value.date.slice(0,7));setDatePickerOpen(true);
  }
  function moveMonth(delta:number){
    const [year,month]=calendarMonth.split("-").map(Number);
    const next=new Date(Date.UTC(year!,month!-1+delta,1)).toISOString().slice(0,7);
    if(next.slice(0,7)<today.slice(0,7)||next.slice(0,7)>limit.slice(0,7))return;
    setCalendarMonth(next);
  }
  const [year,month]=calendarMonth.split("-").map(Number);
  const firstDay=new Date(Date.UTC(year!,month!-1,1)).getUTCDay();
  const days=new Date(Date.UTC(year!,month!,0)).getUTCDate();
  const dateCells=Array.from({length:firstDay+days},(_,index)=>index<firstDay?null:index-firstDay+1);
  const dateLabel=new Intl.DateTimeFormat(locale,{timeZone:"UTC",month:"long",year:"numeric"})
    .format(new Date(calendarMonth+"-01T12:00:00Z"));
  const custom=value.period==="custom";
  return <View testID="venue-advanced-filters" style={styles.root}>
    <AppText weight="semibold">{tr("date")}</AppText>
    <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Chip label={tr("today")} selected={value.date===today} onPress={()=>chooseDate(today)}/>
      <Chip label={tr("tomorrow")} selected={value.date===venueDateAdd(today,1)}
        onPress={()=>chooseDate(venueDateAdd(today,1))}/>
      <Chip label={tr("chooseDate")} selected={value.date!==today&&value.date!==venueDateAdd(today,1)}
        onPress={openCalendar}/>
    </View>
    <AppText variant="caption" weight="medium" style={{color:colors.primary}}>
      {displayDate(value.date,language)}
    </AppText>
    <AppText weight="semibold">{tr("time")}</AppText>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
      {periods.map(period=><Chip key={period} label={tr(period)} selected={value.period===period}
        onPress={()=>set("period",period)}/>)}
    </ScrollView>
    {custom?<View style={styles.customTimes}>
      <TimeOfDayPickerField label={tr("from")} value={value.startTime}
        onChange={time=>set("startTime",time)}/>
      <TimeOfDayPickerField label={tr("to")} value={value.endTime}
        onChange={time=>set("endTime",time)}/>
      <AppText variant="caption" muted>
        {formatClock12From24Hour(value.startTime)} – {formatClock12From24Hour(value.endTime)}
      </AppText>
    </View>:null}
    <Pressable testID="venue-advanced-toggle" accessibilityRole="button"
      accessibilityState={{expanded:advanced}} onPress={()=>setAdvanced(!advanced)}
      style={[styles.expand,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Ionicons name="options-outline" size={18} color={colors.primary}/>
      <AppText weight="semibold" style={{color:colors.primary,flex:1}}>{tr("more")}</AppText>
      <Ionicons name={advanced?"chevron-up":"chevron-down"} color={colors.primary} size={18}/>
    </Pressable>
    {advanced?<View testID="venue-advanced-panel" style={styles.details}>
      <Pressable testID="venue-available-only" accessibilityRole="switch"
        accessibilityState={{checked:value.availableOnly}} onPress={()=>set("availableOnly",!value.availableOnly)}
        style={[styles.switchRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <AppText weight="medium" style={{flex:1}}>{tr("availableOnly")}</AppText>
        <Ionicons name={value.availableOnly?"checkbox":"square-outline"} size={24} color={colors.primary}/>
      </Pressable>
      <AppText weight="semibold">{tr("price")}</AppText>
      <View style={[styles.prices,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={{flex:1,gap:4}}>
          <AppText variant="caption">{tr("minimum")}</AppText>
          <TextInput testID="venue-min-price" keyboardType="number-pad" maxLength={7}
            value={value.minPrice} onChangeText={s=>set("minPrice",s.replace(/[^0-9]/g,""))}
            placeholder="AFN" placeholderTextColor={colors.textMuted}
            accessibilityLabel={tr("minimum")} style={styles.priceInput}/>
        </View>
        <View style={{flex:1,gap:4}}>
          <AppText variant="caption">{tr("maximum")}</AppText>
          <TextInput testID="venue-max-price" keyboardType="number-pad" maxLength={7}
            value={value.maxPrice} onChangeText={s=>set("maxPrice",s.replace(/[^0-9]/g,""))}
            placeholder="AFN" placeholderTextColor={colors.textMuted}
            accessibilityLabel={tr("maximum")} style={styles.priceInput}/>
        </View>
      </View>
      <AppText weight="semibold">{tr("sort")}</AppText>
      <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {sortOptions.map(sort=><Chip key={sort} label={tr(sort)}
          selected={value.sort===sort} onPress={()=>set("sort",sort)}/>)}
      </View>
      {value.sort==="nearest"&&!hasSavedLocation?<AppText variant="caption" muted>
        {tr("locationRequired")}
      </AppText>:null}
    </View>:null}
    {error?<AppText variant="caption" accessibilityLiveRegion="polite"
      style={{color:colors.danger}}>{error}</AppText>:null}
    <Modal transparent animationType="fade" visible={datePickerOpen} onRequestClose={()=>setDatePickerOpen(false)}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={()=>setDatePickerOpen(false)}/>
        <View style={styles.sheet}>
          <View style={[styles.calendarHeading,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Pressable accessibilityLabel={tr("previousMonth")} accessibilityRole="button"
              onPress={()=>moveMonth(-1)} style={styles.monthButton}>
              <Ionicons name={isRTL?"chevron-forward":"chevron-back"} size={22} color={colors.primary}/>
            </Pressable>
            <AppText weight="bold" style={{flex:1,textAlign:"center"}}>{dateLabel}</AppText>
            <Pressable accessibilityLabel={tr("nextMonth")} accessibilityRole="button"
              onPress={()=>moveMonth(1)} style={styles.monthButton}>
              <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={22} color={colors.primary}/>
            </Pressable>
          </View>
          <View style={styles.calendarGrid}>
            {dateCells.map((day,index)=>{
              const full=day?calendarMonth+"-"+String(day).padStart(2,"0"):null;
              const selectable=!!full&&full>=today&&full<=limit;
              return <Pressable key={index} testID={full?("venue-date-"+full):undefined}
                accessibilityRole="button" accessibilityLabel={full??""}
                accessibilityState={{selected:full===value.date,disabled:!selectable}}
                disabled={!selectable} onPress={()=>full&&chooseDate(full)}
                style={[styles.dateCell,full===value.date&&styles.dateActive,!selectable&&styles.dateInactive]}>
                <AppText style={{textAlign:"center",color:full===value.date?"#FFFFFF":colors.text}}>
                  {day??""}
                </AppText>
              </Pressable>;
            })}
          </View>
          <Button variant="secondary" label={t("common.cancel")} onPress={()=>setDatePickerOpen(false)}/>
        </View>
      </View>
    </Modal>
  </View>;
}
function Chip({label,selected,onPress}:{label:string;selected:boolean;onPress:()=>void}){
  return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress}
    style={[styles.chip,selected&&styles.selected]}>
    <AppText variant="caption" weight={selected?"bold":"medium"}
      style={{color:selected?"#FFFFFF":colors.primary,textAlign:"center"}}>{label}</AppText>
  </Pressable>;
}
const styles=StyleSheet.create({
  root:{gap:spacing.sm},
  row:{gap:6,alignItems:"center",flexWrap:"wrap"},
  chip:{borderWidth:1,borderColor:colors.primary,paddingHorizontal:spacing.sm,paddingVertical:7,
    minHeight:38,borderRadius:radius.pill,alignItems:"center",justifyContent:"center",backgroundColor:colors.surface},
  selected:{backgroundColor:colors.primary},
  customTimes:{gap:spacing.sm},
  expand:{padding:spacing.sm,alignItems:"center",gap:spacing.xs,
    borderRadius:radius.md,backgroundColor:colors.primarySoft},
  details:{gap:spacing.sm,paddingTop:spacing.sm},
  switchRow:{minHeight:44,alignItems:"center",gap:spacing.sm},
  prices:{gap:spacing.sm},
  priceInput:{minHeight:45,borderColor:colors.border,borderWidth:1,borderRadius:radius.md,
    paddingHorizontal:spacing.md,color:colors.text,backgroundColor:colors.surface},
  overlay:{flex:1,justifyContent:"center",padding:spacing.md,backgroundColor:"rgba(0,0,0,0.55)"},
  sheet:{width:"100%",maxWidth:480,alignSelf:"center",borderRadius:radius.lg,
    padding:spacing.md,backgroundColor:colors.surface,gap:spacing.md},
  calendarHeading:{alignItems:"center"},
  monthButton:{width:44,height:44,alignItems:"center",justifyContent:"center"},
  calendarGrid:{flexDirection:"row",flexWrap:"wrap",gap:0},
  dateCell:{width:"14.2857%",height:44,alignItems:"center",justifyContent:"center",borderRadius:radius.md},
  dateActive:{backgroundColor:colors.primary},
  dateInactive:{opacity:0.35},
});
