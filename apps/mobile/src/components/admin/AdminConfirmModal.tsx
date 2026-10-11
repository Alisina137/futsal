import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import {Modal,Pressable,StyleSheet,View} from "react-native";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";

export function AdminConfirmModal({visible,target,reason,busy,onCancel,onConfirm}:{
  visible:boolean;target:string;reason:string;busy:boolean;
  onCancel:()=>void;onConfirm:()=>void;
}){
  const {t}=useLocale();
  return <Modal transparent animationType="fade" visible={visible}
    onRequestClose={()=>{if(!busy)onCancel();}}>
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button"
        accessibilityLabel={t("phase7.admin.cancelAction" as never)}
        disabled={busy} onPress={onCancel}/>
      <View style={styles.sheet} accessible accessibilityLabel={t("phase7.admin.confirm" as never)}>
        <View style={styles.icon}><Ionicons name="shield-checkmark-outline" color={colors.primary} size={28}/></View>
        <AppText variant="title" weight="bold">{t("phase7.admin.confirm" as never)}</AppText>
        <AppText muted>{t("phase7.admin.confirmBody" as never)}</AppText>
        <View style={styles.highlight}>
          <AppText variant="caption" muted>{t("phase7.admin.actionTarget" as never)}</AppText>
          <AppText weight="bold">{target}</AppText>
          {reason.trim()?<AppText variant="caption" muted>
            {t("phase7.admin.reason")}: {reason.trim()}
          </AppText>:null}
        </View>
        <AppText variant="caption" muted>{t("phase7.admin.confirmWarning" as never)}</AppText>
        <View style={styles.actions}>
          <Button style={styles.button} variant="secondary"
            label={t("phase7.admin.cancelAction" as never)} disabled={busy}
            onPress={onCancel}/>
          <Button style={styles.button} label={t("phase7.admin.confirm" as never)}
            loading={busy} onPress={onConfirm}/>
        </View>
      </View>
    </View>
  </Modal>;
}
const styles=StyleSheet.create({
  backdrop:{flex:1,backgroundColor:"rgba(8,22,39,.68)",justifyContent:"center",
    alignItems:"center",padding:spacing.lg},
  sheet:{width:"100%",maxWidth:510,backgroundColor:colors.surface,
    borderRadius:radius.lg,padding:spacing.xl,gap:spacing.md},
  icon:{height:52,width:52,borderRadius:radius.md,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  highlight:{borderWidth:1,borderColor:colors.border,backgroundColor:colors.surfaceMuted,
    borderRadius:radius.md,padding:spacing.md,gap:spacing.xs},
  actions:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  button:{flex:1,minWidth:120},
});
