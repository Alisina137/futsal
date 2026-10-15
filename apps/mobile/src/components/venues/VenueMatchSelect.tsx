import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import {useState} from "react";
import {Modal,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";

type Props={
  label:string;value:string;allLabel:string;options:Array<{value:string;label:string}>;
  onSelect:(value:string)=>void;testID:string;
  icon:keyof typeof Ionicons.glyphMap;
};
export function VenueMatchSelect({label,value,allLabel,options,onSelect,testID,icon}:Props){
  const {isRTL,t}=useLocale();
  const [open,setOpen]=useState(false);
  const active=options.find(option=>option.value===value)?.label??allLabel;
  return <View style={styles.field}>
    <AppText variant="caption" weight="semibold" numberOfLines={1}>{label}</AppText>
    <Pressable testID={testID} accessibilityRole="button"
      accessibilityLabel={label+": "+active} accessibilityState={{expanded:open}}
      onPress={()=>setOpen(true)}
      style={[styles.trigger,{flexDirection:isRTL?"row-reverse":"row"},value!==""&&styles.selected]}>
      <Ionicons name={icon} size={17} color={colors.primary}/>
      <AppText variant="caption" weight="semibold" numberOfLines={1}
        style={{flex:1,color:colors.text}}>{active}</AppText>
      <Ionicons name="chevron-down" size={17} color={colors.textMuted}/>
    </Pressable>
    <Modal visible={open} transparent animationType="fade"
      onRequestClose={()=>setOpen(false)}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")}
          onPress={()=>setOpen(false)} style={StyleSheet.absoluteFill}/>
        <View style={styles.dialog}>
          <View style={[styles.head,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <AppText variant="bodyLarge" weight="bold" style={{flex:1}}>{label}</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")}
              onPress={()=>setOpen(false)} style={styles.close}>
              <Ionicons name="close" size={22} color={colors.text}/>
            </Pressable>
          </View>
          <ScrollView>
            {[{value:"",label:allLabel},...options.filter(option=>option.value!=="")].map(option=>{
              const selected=option.value===value;
              return <Pressable key={option.value||"all"} testID={testID+"-option-"+(option.value||"all")}
                accessibilityRole="button" accessibilityState={{selected}}
                onPress={()=>{onSelect(option.value);setOpen(false);}}
                style={[styles.option,{flexDirection:isRTL?"row-reverse":"row"}]}>
                <AppText weight={selected?"bold":"medium"} style={{flex:1}}>{option.label}</AppText>
                {selected?<Ionicons name="checkmark-circle" size={22} color={colors.primary}/>:null}
              </Pressable>;
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}
const styles=StyleSheet.create({
  field:{width:154,gap:spacing.xs},
  trigger:{height:49,alignItems:"center",gap:spacing.xs,paddingHorizontal:spacing.sm,
    backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md},
  selected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  overlay:{flex:1,justifyContent:"center",padding:spacing.md,backgroundColor:"rgba(15,23,42,.6)"},
  dialog:{width:"100%",maxWidth:460,maxHeight:"74%",alignSelf:"center",
    backgroundColor:colors.surface,borderRadius:radius.lg,overflow:"hidden"},
  head:{minHeight:56,paddingHorizontal:spacing.md,gap:spacing.sm,alignItems:"center",
    borderBottomColor:colors.border,borderBottomWidth:1},
  close:{width:44,height:44,alignItems:"center",justifyContent:"center"},
  option:{minHeight:50,alignItems:"center",paddingHorizontal:spacing.lg,gap:spacing.md,
    borderBottomColor:colors.border,borderBottomWidth:1},
});
