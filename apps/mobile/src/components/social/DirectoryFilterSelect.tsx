import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import {useState} from "react";
import {Modal,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";

type Props={label:string;value:string;allLabel:string;options:Array<{value:string;label:string}>;onSelect:(next:string)=>void;testID:string;};
export function DirectoryFilterSelect({label,value,allLabel,options,onSelect,testID}:Props){
  const {isRTL,t}=useLocale();
  const [open,setOpen]=useState(false);
  const selected=options.find(option=>option.value===value)?.label??allLabel;
  return <View style={styles.field}>
    <AppText weight="medium">{label}</AppText>
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{expanded:open}} onPress={()=>setOpen(true)}
      style={[styles.select,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Ionicons name="location-outline" color={colors.primary} size={19}/>
      <AppText weight="medium" numberOfLines={1} style={{flex:1}}>{selected}</AppText>
      <Ionicons name="chevron-down" color={colors.textMuted} size={19}/>
    </Pressable>
    <Modal transparent visible={open} animationType="fade" onRequestClose={()=>setOpen(false)}>
      <View style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")}
          style={styles.backdrop} onPress={()=>setOpen(false)}/>
        <View style={styles.panel}>
          <View style={[styles.header,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <AppText weight="bold" variant="bodyLarge" style={{flex:1}}>{label}</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")}
              onPress={()=>setOpen(false)} style={styles.close}>
              <Ionicons name="close" color={colors.text} size={22}/>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {[{value:"",label:allLabel},...options.filter(x=>x.value!=="")].map(option=>
              <Pressable key={option.value||"all"} accessibilityRole="button"
                accessibilityState={{selected:value===option.value}}
                onPress={()=>{onSelect(option.value);setOpen(false);}}
                style={[styles.option,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <AppText weight={value===option.value?"bold":"regular"} style={{flex:1}}>
                  {option.label}
                </AppText>
                {value===option.value?<Ionicons name="checkmark-circle" color={colors.primary} size={21}/>:null}
              </Pressable>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}
const styles=StyleSheet.create({
  field:{gap:spacing.sm},
  select:{minHeight:51,paddingHorizontal:spacing.md,gap:spacing.sm,alignItems:"center",
    backgroundColor:colors.surface,borderRadius:radius.md,borderColor:colors.border,borderWidth:1},
  root:{flex:1,justifyContent:"center",padding:spacing.md},
  backdrop:{position:"absolute",top:0,bottom:0,left:0,right:0,backgroundColor:"rgba(0,0,0,.55)"},
  panel:{backgroundColor:colors.surface,borderRadius:radius.lg,maxHeight:"75%",overflow:"hidden"},
  header:{minHeight:58,paddingHorizontal:spacing.md,alignItems:"center",borderBottomWidth:1,borderBottomColor:colors.border},
  close:{width:44,height:44,alignItems:"center",justifyContent:"center"},
  option:{minHeight:49,paddingHorizontal:spacing.lg,paddingVertical:spacing.sm,
    borderBottomWidth:1,borderBottomColor:colors.border,alignItems:"center"},
});
