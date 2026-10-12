import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing,touchTarget} from "@leaguekick/design-tokens";
import {useState} from "react";
import {Modal,Pressable,StyleSheet,View,type StyleProp,type ViewStyle} from "react-native";
import {formatClock12From24Hour} from "../../lib/clock-display";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "./AppText";
import {Button} from "./Button";

/**
 * Visible AM/PM picker for venue/referee timetable editing.
 * onChange still emits HH:mm (24h) to preserve existing API contracts,
 * chronological comparisons, validation and database storage.
 */
type Props={
  label:string;value:string;onChange:(value:string)=>void;
  disabled?:boolean;error?:string|null;hint?:string;
  containerStyle?:StyleProp<ViewStyle>;
};
function parse(value:string){
  const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return m?Number(m[1])*60+Number(m[2]):9*60;
}
const wrap=(minutes:number)=>(minutes%(24*60)+24*60)%(24*60);
function toInternal(minutes:number){
  const current=wrap(minutes);
  return String(Math.floor(current/60)).padStart(2,"0")+":"+
    String(current%60).padStart(2,"0");
}
function displayedHour(minutes:number){
  return String(Math.floor(wrap(minutes)/60)%12||12).padStart(2,"0");
}
export function TimeOfDayPickerField({
  label,value,onChange,disabled=false,error,hint,containerStyle,
}:Props){
  const {t,isRTL}=useLocale();
  const [open,setOpen]=useState(false);
  const [draft,setDraft]=useState(()=>parse(value));
  const current=/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)
    ?formatClock12From24Hour(value):t("dateTime.select");
  const minute=String(wrap(draft)%60).padStart(2,"0");
  const period=wrap(draft)>=12*60?"PM":"AM";
  const openPicker=()=>{setDraft(parse(value));setOpen(true);};
  const move=(delta:number)=>setDraft(current=>wrap(current+delta));
  return <View style={[styles.wrapper,containerStyle]} testID="ampm-time-field">
    <AppText weight="medium" style={error?styles.errorText:undefined}>{label}</AppText>
    <Pressable accessibilityRole="button" accessibilityLabel={label}
      accessibilityValue={{text:current}} disabled={disabled} onPress={openPicker}
      style={({pressed})=>[styles.field,{flexDirection:isRTL?"row-reverse":"row"},
        error&&styles.fieldError,disabled&&styles.disabled,pressed&&styles.pressed]}>
      <Ionicons name="time-outline" size={19} color={colors.primary}/>
      <AppText weight="semibold" forceLtr style={styles.valueText}
        numberOfLines={1}>{current}</AppText>
      <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={16} color={colors.textMuted}/>
    </Pressable>
    {error?<AppText variant="caption" style={styles.errorText}>{error}</AppText>
      :hint?<AppText variant="caption" muted>{hint}</AppText>:null}
    <Modal visible={open} transparent animationType="fade"
      statusBarTranslucent onRequestClose={()=>setOpen(false)}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={()=>setOpen(false)}/>
        <View style={styles.sheet}>
          <AppText variant="bodyLarge" weight="bold">{label}</AppText>
          <AppText variant="caption" muted>{t("dateTime.time")}</AppText>
          <View style={styles.controls}>
            <View style={styles.step}>
              <AppText variant="caption" muted>{t("dateTime.hour")}</AppText>
              <View style={styles.stepRow}>
                <Pressable accessibilityRole="button"
                  accessibilityLabel={t("dateTime.hour")+" -"}
                  onPress={()=>move(-60)} style={styles.stepButton}>
                  <Ionicons name="remove" size={22} color={colors.primary}/>
                </Pressable>
                <AppText weight="bold" forceLtr style={styles.numeric}>{displayedHour(draft)}</AppText>
                <Pressable accessibilityRole="button"
                  accessibilityLabel={t("dateTime.hour")+" +"}
                  onPress={()=>move(60)} style={styles.stepButton}>
                  <Ionicons name="add" size={22} color={colors.primary}/>
                </Pressable>
              </View>
            </View>
            <AppText variant="title" weight="bold">:</AppText>
            <View style={styles.step}>
              <AppText variant="caption" muted>{t("dateTime.minute")}</AppText>
              <View style={styles.stepRow}>
                <Pressable accessibilityRole="button"
                  accessibilityLabel={t("dateTime.minute")+" -"}
                  onPress={()=>move(-5)} style={styles.stepButton}>
                  <Ionicons name="remove" size={22} color={colors.primary}/>
                </Pressable>
                <AppText weight="bold" forceLtr style={styles.numeric}>{minute}</AppText>
                <Pressable accessibilityRole="button"
                  accessibilityLabel={t("dateTime.minute")+" +"}
                  onPress={()=>move(5)} style={styles.stepButton}>
                  <Ionicons name="add" size={22} color={colors.primary}/>
                </Pressable>
              </View>
            </View>
          </View>
          <Pressable accessibilityRole="button" testID="ampm-period-switch"
            accessibilityLabel={period}
            accessibilityHint="Switch between AM and PM"
            onPress={()=>move(12*60)} style={styles.periodButton}>
            <AppText weight="bold" forceLtr style={{color:colors.primary}}>{period}</AppText>
          </Pressable>
          <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Button label={t("common.cancel")} variant="secondary" style={{flex:1}}
              onPress={()=>setOpen(false)}/>
            <Button label={t("dateTime.apply")} style={{flex:1}} onPress={()=>{
              onChange(toInternal(draft));setOpen(false);
            }}/>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}
const styles=StyleSheet.create({
  wrapper:{gap:spacing.xs},
  field:{minHeight:touchTarget+4,borderWidth:1,borderColor:colors.border,
    backgroundColor:colors.surface,borderRadius:radius.md,paddingHorizontal:spacing.sm,
    alignItems:"center",gap:spacing.xs},
  fieldError:{borderColor:colors.danger},
  disabled:{opacity:0.5},
  pressed:{backgroundColor:colors.primarySoft},
  valueText:{flex:1,minWidth:0,textAlign:"center"},
  errorText:{color:colors.danger},
  overlay:{flex:1,justifyContent:"flex-end",backgroundColor:colors.overlay},
  sheet:{borderTopLeftRadius:radius.lg,borderTopRightRadius:radius.lg,
    backgroundColor:colors.background,padding:spacing.md,gap:spacing.md,
    paddingBottom:spacing.xxl},
  controls:{flexDirection:"row",flexWrap:"wrap",justifyContent:"center",alignItems:"center",gap:spacing.xs},
  step:{gap:spacing.sm,alignItems:"center"},
  stepRow:{flexDirection:"row",alignItems:"center",gap:spacing.xs},
  stepButton:{height:40,width:35,borderRadius:radius.md,
    backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"},
  numeric:{minWidth:42,textAlign:"center"},
  periodButton:{minHeight:touchTarget,alignItems:"center",justifyContent:"center",
    backgroundColor:colors.primarySoft,borderRadius:radius.md,alignSelf:"center",
    minWidth:110,paddingHorizontal:spacing.md},
  actions:{gap:spacing.sm},
});
