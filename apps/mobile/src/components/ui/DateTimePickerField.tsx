import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing, touchTarget } from "@leaguekick/design-tokens";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AFGHANISTAN_TIME_ZONE } from "../../lib/date-time";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "./AppText";
import { Button } from "./Button";

type DateParts = {
  year:number;
  month:number;
  day:number;
  hour:number;
  minute:number;
};

type Props = {
  label:string;
  value:string;
  onChange:(value:string)=>void;
  minimumDate?:Date;
  hint?:string;
  error?:string|null;
  disabled?:boolean;
};

const KABUL_OFFSET_MS = 270 * 60_000;
const localeByLanguage = {
  "fa-AF":"fa-AF",
  "ps-AF":"ps-AF",
  en:"en-GB",
} as const;

function partsFromDate(value:string|Date):DateParts{
  const date=value instanceof Date?value:new Date(value);
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:AFGHANISTAN_TIME_ZONE,
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
    hour:"2-digit",
    minute:"2-digit",
    hourCycle:"h23",
  }).formatToParts(date);
  const take=(type:string)=>Number(parts.find((part)=>part.type===type)?.value??0);
  return {
    year:take("year"),
    month:take("month"),
    day:take("day"),
    hour:take("hour"),
    minute:take("minute"),
  };
}

function partsToDate(value:DateParts){
  return new Date(Date.UTC(value.year,value.month-1,value.day,value.hour,value.minute)-KABUL_OFFSET_MS);
}

function roundUpFiveMinutes(date:Date){
  const step=5*60_000;
  return new Date(Math.ceil(date.getTime()/step)*step);
}

function daysInMonth(year:number,month:number){
  return new Date(Date.UTC(year,month,0)).getUTCDate();
}

function sameDay(a:DateParts,b:DateParts){
  return a.year===b.year&&a.month===b.month&&a.day===b.day;
}

export function DateTimePickerField({
  label,value,onChange,minimumDate,hint,error,disabled=false,
}:Props){
  const {language,isRTL,t}=useLocale();
  const locale=localeByLanguage[language];
  const [open,setOpen]=useState(false);
  const initial=useMemo(()=>{
    const minimum=minimumDate&&Number.isFinite(minimumDate.getTime())?minimumDate:new Date();
    const source=value&&Number.isFinite(Date.parse(value))?new Date(value):roundUpFiveMinutes(minimum);
    return partsFromDate(source.getTime()<minimum.getTime()?roundUpFiveMinutes(minimum):source);
  },[minimumDate,value]);
  const [draft,setDraft]=useState<DateParts>(initial);
  const [cursor,setCursor]=useState({year:initial.year,month:initial.month});

  function show(){
    const minimum=minimumDate&&Number.isFinite(minimumDate.getTime())?minimumDate:new Date();
    const source=value&&Number.isFinite(Date.parse(value))?new Date(value):roundUpFiveMinutes(minimum);
    const next=partsFromDate(source.getTime()<minimum.getTime()?roundUpFiveMinutes(minimum):source);
    setDraft(next);
    setCursor({year:next.year,month:next.month});
    setOpen(true);
  }

  function moveMonth(delta:number){
    const date=new Date(Date.UTC(cursor.year,cursor.month-1+delta,1));
    setCursor({year:date.getUTCFullYear(),month:date.getUTCMonth()+1});
  }

  function setDay(day:number){
    const candidate={...draft,year:cursor.year,month:cursor.month,day};
    setDraft(candidate);
  }

  function adjustHour(delta:number){
    const next=(draft.hour+delta+24)%24;
    setDraft({...draft,hour:next});
  }

  function adjustMinute(delta:number){
    const total=draft.hour*60+draft.minute+delta;
    const wrapped=(total%(24*60)+(24*60))%(24*60);
    setDraft({...draft,hour:Math.floor(wrapped/60),minute:wrapped%60});
  }

  const selectedDate=partsToDate(draft);
  const minimumTime=minimumDate?.getTime()??Number.NEGATIVE_INFINITY;
  const belowMinimum=selectedDate.getTime()<minimumTime;
  const firstWeekday=new Date(Date.UTC(cursor.year,cursor.month-1,1)).getUTCDay();
  const count=daysInMonth(cursor.year,cursor.month);
  const calendarCells=Array.from({length:42},(_,index)=>{
    const day=index-firstWeekday+1;
    return day>=1&&day<=count?day:null;
  });
  const minParts=minimumDate?partsFromDate(minimumDate):null;
  const monthTitle=new Intl.DateTimeFormat(locale,{
    calendar:"gregory",
    timeZone:"UTC",
    year:"numeric",
    month:"long",
  }).format(new Date(Date.UTC(cursor.year,cursor.month-1,1)));
  const weekdayLabels=Array.from({length:7},(_,index)=>
    new Intl.DateTimeFormat(locale,{weekday:"short",timeZone:"UTC"})
      .format(new Date(Date.UTC(2026,7,2+index))),
  );
  const display=value&&Number.isFinite(Date.parse(value))
    ?new Intl.DateTimeFormat(locale,{
      calendar:"gregory",
      timeZone:AFGHANISTAN_TIME_ZONE,
      year:"numeric",
      month:"short",
      day:"numeric",
      hour:"2-digit",
      minute:"2-digit",
    }).format(new Date(value))
    :t("dateTime.select");
  const minimumDisplay=minimumDate
    ?new Intl.DateTimeFormat(locale,{
      calendar:"gregory",
      timeZone:AFGHANISTAN_TIME_ZONE,
      year:"numeric",
      month:"short",
      day:"numeric",
      hour:"2-digit",
      minute:"2-digit",
    }).format(minimumDate)
    :null;

  return <View style={styles.wrapper}>
    <AppText weight="medium" style={error?styles.errorText:undefined}>{label}</AppText>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      disabled={disabled}
      onPress={show}
      style={({pressed})=>[
        styles.field,
        error&&styles.fieldError,
        disabled&&styles.fieldDisabled,
        pressed&&!disabled&&styles.fieldPressed,
        {flexDirection:isRTL?"row-reverse":"row"},
      ]}
    >
      <View style={styles.iconShell}>
        <Ionicons name="calendar-outline" size={21} color={error?colors.danger:colors.primary}/>
      </View>
      <View style={[styles.fieldText,{alignItems:isRTL?"flex-end":"flex-start"}]}>
        <AppText weight={value?"semibold":"regular"} muted={!value} style={{textAlign:isRTL?"right":"left"}}>
          {display}
        </AppText>
        {value?<AppText variant="caption" muted>{t("dateTime.afghanistanTime")}</AppText>:null}
      </View>
      <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={19} color={colors.textMuted}/>
    </Pressable>
    {error?<AppText variant="caption" style={styles.errorText}>{error}</AppText>
      :hint?<AppText variant="caption" muted>{hint}</AppText>:null}

    <Modal visible={open} transparent animationType="fade" onRequestClose={()=>setOpen(false)} statusBarTranslucent>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={()=>setOpen(false)}/>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            <View style={[styles.sheetHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <View style={{flex:1,alignItems:isRTL?"flex-end":"flex-start"}}>
                <AppText variant="bodyLarge" weight="bold">{label}</AppText>
                <AppText variant="caption" muted>{t("dateTime.chooseDateTime")}</AppText>
              </View>
              <Pressable onPress={()=>setOpen(false)} style={styles.closeButton}>
                <Ionicons name="close" size={22} color={colors.text}/>
              </Pressable>
            </View>

            <View style={styles.calendarCard}>
              <View style={[styles.monthHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <Pressable onPress={()=>moveMonth(isRTL?1:-1)} style={styles.monthButton}>
                  <Ionicons name={isRTL?"chevron-forward":"chevron-back"} size={20} color={colors.primary}/>
                </Pressable>
                <AppText weight="bold">{monthTitle}</AppText>
                <Pressable onPress={()=>moveMonth(isRTL?-1:1)} style={styles.monthButton}>
                  <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={20} color={colors.primary}/>
                </Pressable>
              </View>

              <View style={[styles.weekRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
                {weekdayLabels.map((day,index)=><View key={index} style={styles.dayCell}>
                  <AppText variant="caption" muted style={{textAlign:"center"}}>{day}</AppText>
                </View>)}
              </View>

              <View style={[styles.daysGrid,{flexDirection:isRTL?"row-reverse":"row"}]}>
                {calendarCells.map((day,index)=>{
                  if(day===null)return <View key={index} style={styles.dayCell}/>;
                  const cell={...draft,year:cursor.year,month:cursor.month,day};
                  const selected=sameDay(cell,draft);
                  const cellEnd=partsToDate({...cell,hour:23,minute:59});
                  const disabledDay=Boolean(minimumDate&&cellEnd.getTime()<minimumDate.getTime());
                  return <View key={index} style={styles.dayCell}>
                    <Pressable
                      disabled={disabledDay}
                      onPress={()=>setDay(day)}
                      style={[
                        styles.dayButton,
                        selected&&styles.dayButtonSelected,
                        disabledDay&&styles.dayButtonDisabled,
                      ]}
                    >
                      <AppText
                        variant="caption"
                        weight={selected?"bold":"regular"}
                        style={selected?{color:"#FFFFFF"}:disabledDay?{color:colors.textMuted}:undefined}
                      >
                        {new Intl.NumberFormat(locale).format(day)}
                      </AppText>
                    </Pressable>
                  </View>;
                })}
              </View>
            </View>

            <View style={styles.timeCard}>
              <View style={[styles.timeHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <Ionicons name="time-outline" size={20} color={colors.primary}/>
                <AppText weight="bold">{t("dateTime.time")}</AppText>
              </View>
              <View style={[styles.timeControls,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <TimeStepper
                  label={t("dateTime.hour")}
                  value={draft.hour}
                  onMinus={()=>adjustHour(-1)}
                  onPlus={()=>adjustHour(1)}
                  locale={locale}
                />
                <AppText variant="title" weight="bold">:</AppText>
                <TimeStepper
                  label={t("dateTime.minute")}
                  value={draft.minute}
                  onMinus={()=>adjustMinute(-5)}
                  onPlus={()=>adjustMinute(5)}
                  locale={locale}
                  twoDigits
                />
              </View>
            </View>

            {minimumDisplay?<View style={[styles.minimumNotice,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Ionicons name="information-circle-outline" size={19} color={belowMinimum?colors.danger:colors.primary}/>
              <AppText variant="caption" style={{flex:1,color:belowMinimum?colors.danger:colors.textMuted}}>
                {t("dateTime.minimum",{value:minimumDisplay})}
              </AppText>
            </View>:null}

            <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Button label={t("common.cancel")} onPress={()=>setOpen(false)} variant="secondary" style={{flex:1}}/>
              <Button
                label={t("dateTime.apply")}
                onPress={()=>{
                  onChange(partsToDate(draft).toISOString());
                  setOpen(false);
                }}
                disabled={belowMinimum}
                style={{flex:1}}
              />
            </View>
            {value?<Button label={t("dateTime.clear")} onPress={()=>{onChange("");setOpen(false);}} variant="ghost"/>:null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}

function TimeStepper({
  label,value,onMinus,onPlus,locale,twoDigits=false,
}:{
  label:string;
  value:number;
  onMinus:()=>void;
  onPlus:()=>void;
  locale:string;
  twoDigits?:boolean;
}){
  const formatted=new Intl.NumberFormat(locale,{
    minimumIntegerDigits:twoDigits?2:1,
    useGrouping:false,
  }).format(value);
  return <View style={styles.stepper}>
    <AppText variant="caption" muted>{label}</AppText>
    <View style={styles.stepperRow}>
      <Pressable onPress={onMinus} style={styles.stepperButton}>
        <Ionicons name="remove" size={20} color={colors.primary}/>
      </Pressable>
      <View style={styles.stepperValue}><AppText variant="bodyLarge" weight="bold">{formatted}</AppText></View>
      <Pressable onPress={onPlus} style={styles.stepperButton}>
        <Ionicons name="add" size={20} color={colors.primary}/>
      </Pressable>
    </View>
  </View>;
}

const styles=StyleSheet.create({
  wrapper:{gap:spacing.sm},
  field:{
    minHeight:touchTarget+8,
    alignItems:"center",
    gap:spacing.sm,
    paddingHorizontal:spacing.md,
    paddingVertical:spacing.sm,
    borderWidth:1,
    borderColor:colors.border,
    borderRadius:radius.md,
    backgroundColor:colors.surface,
  },
  fieldPressed:{borderColor:colors.primary,backgroundColor:"#FBFDFF"},
  fieldError:{borderColor:colors.danger},
  fieldDisabled:{opacity:.55},
  fieldText:{flex:1,minWidth:0,gap:2},
  iconShell:{
    width:38,height:38,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft,
  },
  errorText:{color:colors.danger},
  modalRoot:{
    flex:1,
    justifyContent:"flex-end",
    backgroundColor:colors.overlay,
  },
  sheet:{
    maxHeight:"92%",
    borderTopLeftRadius:radius.lg,
    borderTopRightRadius:radius.lg,
    backgroundColor:colors.background,
    overflow:"hidden",
  },
  sheetContent:{padding:spacing.md,gap:spacing.md,paddingBottom:spacing.xxl},
  sheetHeader:{alignItems:"center",gap:spacing.sm},
  closeButton:{
    width:42,height:42,borderRadius:21,alignItems:"center",justifyContent:"center",backgroundColor:colors.surfaceMuted,
  },
  calendarCard:{
    padding:spacing.sm,
    gap:spacing.sm,
    borderWidth:1,
    borderColor:colors.border,
    borderRadius:radius.lg,
    backgroundColor:colors.surface,
  },
  monthHeader:{alignItems:"center",justifyContent:"space-between",gap:spacing.sm},
  monthButton:{
    width:42,height:42,borderRadius:21,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft,
  },
  weekRow:{flexWrap:"nowrap"},
  daysGrid:{flexWrap:"wrap"},
  dayCell:{width:"14.285714%",padding:2,alignItems:"center",justifyContent:"center"},
  dayButton:{
    width:38,height:38,borderRadius:19,alignItems:"center",justifyContent:"center",
  },
  dayButtonSelected:{backgroundColor:colors.primary},
  dayButtonDisabled:{opacity:.35},
  timeCard:{
    gap:spacing.md,
    padding:spacing.md,
    borderWidth:1,
    borderColor:colors.border,
    borderRadius:radius.lg,
    backgroundColor:colors.surface,
  },
  timeHeader:{alignItems:"center",gap:spacing.sm},
  timeControls:{alignItems:"flex-end",justifyContent:"center",gap:spacing.md},
  stepper:{alignItems:"center",gap:spacing.xs},
  stepperRow:{flexDirection:"row",alignItems:"center",gap:spacing.xs},
  stepperButton:{
    width:42,height:42,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft,
  },
  stepperValue:{
    minWidth:54,height:42,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:colors.surfaceMuted,
  },
  minimumNotice:{
    alignItems:"flex-start",
    gap:spacing.sm,
    padding:spacing.sm,
    borderRadius:radius.md,
    backgroundColor:colors.surfaceMuted,
  },
  actions:{gap:spacing.sm},
});
