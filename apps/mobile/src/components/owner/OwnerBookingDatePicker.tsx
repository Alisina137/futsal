import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import {useState} from "react";
import {Modal,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {addDays,formatCalendarDate,formatWeekdayName,isSameDisplayMonth,
  monthGridRange,moveView,orderedWeekdays,todayKabul} from "../../lib/timetable-calendar";
import {validBookingDay} from "../../lib/owner-bookings";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";

/** Bookings can be searched in the past or future; unlike reservation pickers,
 * these two history/search calendars have no future/past booking restriction.
 * Values are always Gregorian YYYY-MM-DD for the API, displayed using the
 * user's Solar Hijri (Dari/Pashto) or Gregorian (English) calendar. */
export function OwnerBookingDatePicker({label,value,onChange,testID}:{
  label:string;value:string;onChange:(next:string)=>void;testID:string;
}){
  const {t,language,isRTL}=useLocale();
  const [open,setOpen]=useState(false);
  const [anchor,setAnchor]=useState(()=>validBookingDay(value)?value:todayKabul());
  const today=todayKabul();
  const start=monthGridRange(anchor,language).from;
  const dates=Array.from({length:42},(_,i)=>addDays(start,i));
  const shown=value&&validBookingDay(value)
    ?formatCalendarDate(value,language,{day:"numeric",month:"short",year:"numeric"})
    :t("owner.phase3.anyDate");
  return <View style={styles.wrapper}>
    <AppText variant="caption" weight="semibold">{label}</AppText>
    <Pressable testID={testID} accessibilityRole="button"
      accessibilityLabel={label+": "+shown}
      accessibilityState={{expanded:open}}
      onPress={()=>{setAnchor(validBookingDay(value)?value:today);setOpen(true);}}
      style={[styles.trigger,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Ionicons name="calendar-outline" size={19} color={colors.primary}/>
      <AppText numberOfLines={1} variant="caption" weight="semibold" style={{flex:1,minWidth:0}}>
        {shown}
      </AppText>
      <Ionicons name="chevron-down" size={16} color={colors.textMuted}/>
    </Pressable>
    <Modal transparent visible={open} animationType="fade" onRequestClose={()=>setOpen(false)}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")}
          style={StyleSheet.absoluteFill} onPress={()=>setOpen(false)}/>
        <View style={styles.dialog} testID={testID+"-calendar"}>
          <View style={[styles.header,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <View style={{flex:1,minWidth:0,gap:3}}>
              <AppText weight="bold" variant="bodyLarge">{label}</AppText>
              <AppText variant="caption" muted>{t("owner.phase3.chooseSearchDate")}</AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")}
              onPress={()=>setOpen(false)} style={styles.close}>
              <Ionicons name="close" size={22} color={colors.text}/>
            </Pressable>
          </View>
          <View style={[styles.monthControls,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Pressable testID={testID+"-prev"} accessibilityRole="button"
              accessibilityLabel={t("owner.phase3.previousMonth")}
              onPress={()=>setAnchor(v=>moveView("MONTH",v,-1,language))} style={styles.monthButton}>
              <Ionicons name="chevron-back" size={21} color={colors.primary}/>
            </Pressable>
            <AppText weight="bold" numberOfLines={1} style={{flex:1,textAlign:"center"}}>
              {formatCalendarDate(anchor,language,{month:"long",year:"numeric"})}
            </AppText>
            <Pressable testID={testID+"-next"} accessibilityRole="button"
              accessibilityLabel={t("owner.phase3.nextMonth")}
              onPress={()=>setAnchor(v=>moveView("MONTH",v,1,language))} style={styles.monthButton}>
              <Ionicons name="chevron-forward" size={21} color={colors.primary}/>
            </Pressable>
          </View>
          <ScrollView style={{flexGrow:0}} contentContainerStyle={styles.calendar}>
            <View style={[styles.week,{flexDirection:isRTL?"row-reverse":"row"}]}>
              {orderedWeekdays(language).map(day=><View key={day} style={styles.cell}>
                <AppText variant="caption" muted style={{textAlign:"center"}}>
                  {formatWeekdayName(day,language)}
                </AppText>
              </View>)}
            </View>
            {Array.from({length:6},(_,row)=><View key={row}
              style={[styles.week,{flexDirection:isRTL?"row-reverse":"row"}]}>
              {dates.slice(row*7,row*7+7).map(day=>{
                const selected=day===value;
                const currentMonth=isSameDisplayMonth(day,anchor,language);
                return <View key={day} style={styles.cell}>
                  <Pressable testID={testID+"-day-"+day} accessibilityRole="button"
                    accessibilityLabel={formatCalendarDate(day,language,{
                      weekday:"long",day:"numeric",month:"long",year:"numeric"})}
                    accessibilityState={{selected}}
                    onPress={()=>{onChange(day);setOpen(false);}}
                    style={[styles.day,selected&&styles.selected,!currentMonth&&styles.outside]}>
                    <AppText variant="caption" weight={selected?"bold":"medium"}
                      style={[{textAlign:"center"},selected&&styles.selectedText]}>
                      {formatCalendarDate(day,language,{day:"numeric"})}
                    </AppText>
                  </Pressable>
                </View>;
              })}
            </View>)}
          </ScrollView>
          <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Button label={t("dateTime.clear")} variant="secondary"
              onPress={()=>{onChange("");setOpen(false);}} style={{flex:1}}/>
            <Button label={t("common.cancel")} variant="ghost"
              onPress={()=>setOpen(false)} style={{flex:1}}/>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}
const styles=StyleSheet.create({
  wrapper:{gap:spacing.xs,flex:1,minWidth:0},
  trigger:{minHeight:48,alignItems:"center",gap:spacing.xs,
    borderWidth:1,borderColor:colors.border,borderRadius:radius.md,
    paddingHorizontal:spacing.sm,backgroundColor:colors.surface},
  overlay:{flex:1,backgroundColor:"rgba(15,23,42,.6)",justifyContent:"center",
    padding:spacing.md},
  dialog:{backgroundColor:colors.surface,borderRadius:radius.lg,padding:spacing.md,
    width:"100%",maxWidth:440,alignSelf:"center",maxHeight:"90%",gap:spacing.md},
  header:{alignItems:"center",gap:spacing.sm},
  close:{width:44,height:44,alignItems:"center",justifyContent:"center"},
  monthControls:{alignItems:"center",gap:spacing.sm},
  monthButton:{width:44,height:44,borderRadius:radius.md,
    alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  calendar:{gap:3},
  week:{alignItems:"center",width:"100%"},
  cell:{width:"14.285714%",padding:2},
  day:{minHeight:43,alignItems:"center",justifyContent:"center",borderRadius:radius.sm},
  selected:{backgroundColor:colors.primary},
  selectedText:{color:"#FFFFFF"},
  outside:{opacity:.43},
  actions:{gap:spacing.sm},
});
