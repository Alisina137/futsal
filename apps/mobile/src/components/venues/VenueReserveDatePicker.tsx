import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import {useEffect,useMemo,useState} from "react";
import {Modal,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {formatCalendarDate,formatWeekdayName,moveView,orderedWeekdays} from "../../lib/timetable-calendar";
import {isValidVenueDay} from "../../lib/venue-detail-dates";
import {venuePickerCanMoveMonth,venuePickerMonthDays} from "../../lib/venue-reserve-date-picker";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";

type Props={
  selected:string;
  today:string;
  maximumAdvanceBookingDays:number;
  onChange:(day:string)=>void;
};

/** Expo Go compatible picker with real calendar months in English/Dari/Pashto.
 * No keyboard or unsupported native date-picker dependency is required. */
export function VenueReserveDatePicker({selected,today,maximumAdvanceBookingDays,onChange}:Props){
  const {t,language,isRTL}=useLocale();
  const [open,setOpen]=useState(false);
  const [anchor,setAnchor]=useState(isValidVenueDay(selected)?selected:today);
  useEffect(()=>{
    if(open)setAnchor(isValidVenueDay(selected)?selected:today);
  },[open,selected,today]);
  const days=useMemo(()=>venuePickerMonthDays(anchor,today,maximumAdvanceBookingDays,language),
    [anchor,today,maximumAdvanceBookingDays,language]);
  const previousEnabled=venuePickerCanMoveMonth(anchor,-1,today,maximumAdvanceBookingDays,language);
  const nextEnabled=venuePickerCanMoveMonth(anchor,1,today,maximumAdvanceBookingDays,language);
  const end=useMemo(()=>{
    const value=new Date(today+"T12:00:00Z");
    value.setUTCDate(value.getUTCDate()+maximumAdvanceBookingDays);
    return value.toISOString().slice(0,10);
  },[today,maximumAdvanceBookingDays]);
  const displayDate=isValidVenueDay(selected)
    ?formatCalendarDate(selected,language,{year:"numeric",month:"short",day:"numeric"})
    :selected;
  const dismiss=()=>setOpen(false);
  return <>
    <Pressable testID="venue-offers-date-picker-trigger"
      accessibilityRole="button"
      accessibilityLabel={t("booking.date")+": "+displayDate}
      accessibilityHint={t("vd.chooseDate")}
      onPress={()=>setOpen(true)}
      style={[styles.trigger,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Ionicons name="calendar-outline" size={22} color={colors.primary}/>
      <View style={styles.selected}>
        <AppText variant="caption" muted>{t("booking.date")}</AppText>
        <AppText weight="semibold">{displayDate}</AppText>
      </View>
      <Ionicons name="chevron-down-outline" size={18} color={colors.textMuted}/>
    </Pressable>
    <AppText variant="caption" muted>
      {t("vd.dateLimit")} {formatCalendarDate(end,language,{year:"numeric",month:"short",day:"numeric"})}
    </AppText>
    <Modal visible={open} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")}
          onPress={dismiss} style={StyleSheet.absoluteFill}/>
        <View style={styles.dialog} testID="venue-offers-date-picker-dialog">
          <View style={[styles.titleRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Ionicons name="calendar" size={22} color={colors.primary}/>
            <AppText variant="bodyLarge" weight="bold" style={styles.title}>{t("vd.chooseDate")}</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")}
              onPress={dismiss} style={styles.close}>
              <Ionicons name="close" size={22} color={colors.text}/>
            </Pressable>
          </View>
          <View style={[styles.monthControls,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Pressable testID="venue-offers-date-previous-month"
              accessibilityRole="button" accessibilityLabel={t("vd.previousDate")}
              accessibilityState={{disabled:!previousEnabled}}
              disabled={!previousEnabled}
              onPress={()=>setAnchor(value=>moveView("MONTH",value,-1,language))}
              style={[styles.monthArrow,!previousEnabled&&styles.disabled]}>
              <Ionicons name="chevron-back" size={23} color={colors.primary}/>
            </Pressable>
            <AppText weight="bold" style={styles.monthName}>
              {formatCalendarDate(anchor,language,{year:"numeric",month:"long"})}
            </AppText>
            <Pressable testID="venue-offers-date-next-month"
              accessibilityRole="button" accessibilityLabel={t("vd.nextDate")}
              accessibilityState={{disabled:!nextEnabled}}
              disabled={!nextEnabled}
              onPress={()=>setAnchor(value=>moveView("MONTH",value,1,language))}
              style={[styles.monthArrow,!nextEnabled&&styles.disabled]}>
              <Ionicons name="chevron-forward" size={23} color={colors.primary}/>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.calendarScroll}>
            <View style={[styles.week,{flexDirection:isRTL?"row-reverse":"row"}]}>
              {orderedWeekdays(language).map(weekday=><View key={weekday} style={styles.dayCell}>
                <AppText variant="caption" muted style={styles.center}>
                  {formatWeekdayName(weekday,language)}
                </AppText>
              </View>)}
            </View>
            {Array.from({length:6},(_,week)=><View key={week}
              style={[styles.week,{flexDirection:isRTL?"row-reverse":"row"}]}>
              {days.slice(week*7,week*7+7).map(day=>{
                const active=day.date===selected;
                return <View key={day.date} style={styles.dayCell}>
                  <Pressable testID={"venue-offers-date-"+day.date}
                    accessibilityRole="button"
                    accessibilityLabel={formatCalendarDate(day.date,language,{
                      weekday:"long",year:"numeric",month:"long",day:"numeric",
                    })}
                    accessibilityState={{disabled:!day.enabled,selected:active}}
                    disabled={!day.enabled}
                    onPress={()=>{onChange(day.date);dismiss();}}
                    style={[styles.dayButton,active&&styles.daySelected,
                      !day.currentMonth&&styles.otherMonth,!day.enabled&&styles.disabled]}>
                    <AppText variant="caption" weight={active?"bold":"medium"}
                      style={[styles.center,active&&styles.selectedText]}>
                      {formatCalendarDate(day.date,language,{day:"numeric"})}
                    </AppText>
                  </Pressable>
                </View>;
              })}
            </View>)}
          </ScrollView>
          <View style={[styles.footer,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Button variant="secondary" label={t("common.cancel")} onPress={dismiss}/>
          </View>
        </View>
      </View>
    </Modal>
  </>;
}

const styles=StyleSheet.create({
  trigger:{minHeight:56,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,
    backgroundColor:colors.surface,alignItems:"center",gap:spacing.md,
    paddingHorizontal:spacing.md,paddingVertical:spacing.sm},
  selected:{flex:1,gap:2},
  overlay:{flex:1,backgroundColor:"rgba(15,23,42,.65)",
    alignItems:"center",justifyContent:"center",padding:spacing.md},
  dialog:{width:"100%",maxWidth:440,maxHeight:"90%",backgroundColor:colors.surface,
    borderRadius:radius.lg,padding:spacing.md,gap:spacing.md},
  titleRow:{alignItems:"center",gap:spacing.sm},
  title:{flex:1},
  close:{width:44,height:44,justifyContent:"center",alignItems:"center"},
  monthControls:{alignItems:"center",justifyContent:"space-between",gap:spacing.xs},
  monthArrow:{minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center",
    borderRadius:radius.md,backgroundColor:colors.primarySoft},
  monthName:{flex:1,textAlign:"center"},
  calendarScroll:{gap:2},
  week:{width:"100%",alignItems:"center"},
  dayCell:{flex:1,minWidth:0,alignItems:"center",justifyContent:"center"},
  dayButton:{width:"100%",minHeight:44,alignItems:"center",justifyContent:"center",
    borderRadius:radius.md},
  daySelected:{backgroundColor:colors.primary},
  selectedText:{color:"#FFFFFF"},
  otherMonth:{opacity:.55},
  disabled:{opacity:.3},
  center:{textAlign:"center"},
  footer:{justifyContent:"flex-end"},
});
