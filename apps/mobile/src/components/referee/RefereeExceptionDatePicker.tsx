import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import {useState} from "react";
import {Modal,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {formatRefereeCalendarPeriod,formatRefereeScheduleParts} from "../../lib/date-time";
import {refereeKabulDay,refereeCalendarMove,refereeCalendarWeekDays} from "../../lib/referee-calendar";
import {refereeExceptionMonth} from "../../lib/referee-settings";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";

export function RefereeExceptionDatePicker({value,onChange,label}:{
  value:string;onChange:(date:string)=>void;label:string;
}){
  const {language,isRTL,t}=useLocale();
  const today=refereeKabulDay(new Date())??"2026-01-01";
  const [visible,setVisible]=useState(false);
  const [cursor,setCursor]=useState(value||today);
  const month=refereeExceptionMonth(cursor,language);
  const weekdays=refereeCalendarWeekDays("2026-10-17",language).map(date=>
    new Intl.DateTimeFormat(language==="en"?"en-GB":language,{
      timeZone:"UTC",weekday:"short",
    }).format(new Date(date+"T12:00:00Z")));
  const dayNumber=new Intl.NumberFormat(language==="en"?"en-GB":language);
  const calendarDay=(day:string)=>{
    const parts=new Intl.DateTimeFormat(language==="en"?"en-GB":language,{
      timeZone:"UTC",calendar:language==="en"?"gregory":"persian",
      numberingSystem:"latn",day:"numeric",
    }).formatToParts(new Date(day+"T12:00:00Z"));
    return Number(parts.find(part=>part.type==="day")?.value??0);
  };
  const display=value?formatRefereeScheduleParts(value+"T12:00:00Z",language).date:
    t("rf1.settingsPickDate");
  const move=(direction:number)=>setCursor(day=>
    refereeCalendarMove(day,"month",direction,language));
  return <View style={styles.container}>
    <AppText weight="semibold">{label}</AppText>
    <Pressable testID="referee-exception-date-open" accessibilityRole="button"
      accessibilityLabel={label} onPress={()=>{
        setCursor(value||today);setVisible(true);
      }} style={[styles.field,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Ionicons name="calendar-outline" color={colors.primary} size={21}/>
      <AppText style={{flex:1,textAlign:isRTL?"right":"left"}} weight="semibold">{display}</AppText>
      <Ionicons name={isRTL?"chevron-back":"chevron-forward"} color={colors.textMuted} size={18}/>
    </Pressable>
    <Modal transparent animationType="fade" visible={visible} onRequestClose={()=>setVisible(false)}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={()=>setVisible(false)}/>
        <View style={styles.panel}>
          <ScrollView contentContainerStyle={{gap:spacing.md}}>
            <AppText variant="bodyLarge" weight="bold">{label}</AppText>
            <View style={[styles.monthHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Pressable accessibilityRole="button" onPress={()=>move(-1)} style={styles.arrow}>
                <Ionicons name="chevron-back" color={colors.primary} size={21}/>
              </Pressable>
              <AppText weight="bold" style={{flex:1,textAlign:"center"}}>
                {formatRefereeCalendarPeriod(new Date(cursor+"T12:00:00Z"),"month",language)}
              </AppText>
              <Pressable accessibilityRole="button" onPress={()=>move(1)} style={styles.arrow}>
                <Ionicons name="chevron-forward" color={colors.primary} size={21}/>
              </Pressable>
            </View>
            <View style={[styles.grid,{flexDirection:isRTL?"row-reverse":"row"}]}>
              {weekdays.map((name,i)=><View key={i} style={styles.cell}>
                <AppText variant="caption" muted style={{textAlign:"center"}}>{name}</AppText>
              </View>)}
              {month.cells.map(day=><View key={day.date} style={styles.cell}>
                {day.inMonth?<Pressable testID={"referee-exception-day-"+day.date}
                  accessibilityRole="button" accessibilityLabel={day.date}
                  accessibilityState={{selected:value===day.date}}
                  onPress={()=>{onChange(day.date);setVisible(false);}}
                  style={[styles.dayButton,value===day.date&&styles.selected]}>
                  <AppText variant="caption" weight={value===day.date?"bold":"regular"}
                    style={{textAlign:"center",color:value===day.date?"#FFFFFF":colors.text}}>
                    {dayNumber.format(calendarDay(day.date))}
                  </AppText>
                </Pressable>:null}
              </View>)}
            </View>
            <View style={styles.bottom}>
              <Button label={t("rf1.settingsDateToday")} variant="secondary"
                onPress={()=>setCursor(today)}/>
              <Button label={t("common.cancel")} variant="secondary"
                onPress={()=>setVisible(false)}/>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}
const styles=StyleSheet.create({
  container:{gap:spacing.sm},
  field:{minHeight:48,alignItems:"center",gap:spacing.sm,padding:spacing.md,
    backgroundColor:colors.surfaceMuted,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.md},
  overlay:{flex:1,justifyContent:"center",padding:spacing.md,
    backgroundColor:"rgba(0,0,0,0.55)"},
  panel:{backgroundColor:colors.surface,borderRadius:radius.md,
    maxHeight:"85%",padding:spacing.lg},
  monthHeader:{alignItems:"center",gap:spacing.sm},
  arrow:{minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center"},
  grid:{flexDirection:"row",flexWrap:"wrap",rowGap:spacing.xs},
  cell:{width:"14.2857%",minHeight:39,justifyContent:"center"},
  dayButton:{minHeight:39,borderRadius:radius.md,alignItems:"center",justifyContent:"center"},
  selected:{backgroundColor:colors.primary},
  bottom:{flexDirection:"row",gap:spacing.sm,justifyContent:"space-between"},
});
