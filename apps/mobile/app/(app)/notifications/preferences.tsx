import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {NotificationPreferences} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useState} from "react";
import {Pressable,StyleSheet,Switch,View} from "react-native";
import {notificationApi} from "../../../src/lib/api";
import {AppText} from "../../../src/components/ui/AppText";
import {Button} from "../../../src/components/ui/Button";
import {Card} from "../../../src/components/ui/Card";
import {DataLoadingState} from "../../../src/components/ui/DataLoadingState";
import {Screen} from "../../../src/components/ui/Screen";
import {useAuth} from "../../../src/providers/AuthProvider";
import {useLocale} from "../../../src/providers/LocaleProvider";

const defaults:NotificationPreferences={
  inAppEnabled:true,pushEnabled:true,promotionsEnabled:true,
  venuePostsEnabled:true,teamInvitesEnabled:true,
};
type PrefKey=keyof NotificationPreferences;
const delivery:PrefKey[]=["inAppEnabled","pushEnabled"];
const content:PrefKey[]=["promotionsEnabled","venuePostsEnabled","teamInvitesEnabled"];
const labels:Record<PrefKey,string>={
  inAppEnabled:"notifications.inApp",pushEnabled:"notifications.push",
  promotionsEnabled:"notifications.promotions",venuePostsEnabled:"notifications.venuePosts",
  teamInvitesEnabled:"notifications.teamInvites",
};
const descriptions:Record<PrefKey,string>={
  inAppEnabled:"notifications.prefs.inAppBody",pushEnabled:"notifications.prefs.pushBody",
  promotionsEnabled:"notifications.prefs.promotionsBody",venuePostsEnabled:"notifications.prefs.venuePostsBody",
  teamInvitesEnabled:"notifications.prefs.teamInvitesBody",
};
const iconMap:Record<PrefKey,keyof typeof Ionicons.glyphMap>={
  inAppEnabled:"notifications-outline",pushEnabled:"phone-portrait-outline",
  promotionsEnabled:"pricetag-outline",venuePostsEnabled:"megaphone-outline",
  teamInvitesEnabled:"people-outline",
};
export default function NotificationPreferencesScreen(){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const token=session?.accessToken;
  const [prefs,setPrefs]=useState<NotificationPreferences>(defaults);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState<PrefKey|null>(null);
  const [retry,setRetry]=useState(0);
  useFocusEffect(useCallback(()=>{
    let active=true;
    if(!token){setLoading(false);return()=>{active=false;};}
    setLoading(true);setError(null);
    void notificationApi.preferences(token).then(result=>{
      if(active)setPrefs(result.preferences);
    }).catch(()=>{
      if(active)setError(t("notifications.loadError"));
    }).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[token,t,retry]));

  async function toggle(key:PrefKey,value:boolean){
    if(!token||busy)return;
    const previous=prefs;
    setPrefs({...prefs,[key]:value});setBusy(key);setError(null);
    try{
      const result=await notificationApi.updatePreferences(token,{[key]:value});
      setPrefs(result.preferences);
    }catch{
      setPrefs(previous);setError(t("notifications.preferenceError"));
    }finally{setBusy(null);}
  }
  function row(key:PrefKey){
    return <View key={key} style={[styles.setting,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={styles.icon}>
        <Ionicons name={iconMap[key]} size={21} color={colors.primary}/>
      </View>
      <View style={{flex:1,gap:3}}>
        <AppText weight="semibold">{t(labels[key] as never)}</AppText>
        <AppText variant="caption" muted>{t(descriptions[key] as never)}</AppText>
      </View>
      <Switch accessibilityLabel={t(labels[key] as never)}
        accessibilityState={{disabled:busy!==null}}
        value={prefs[key]} disabled={busy!==null}
        onValueChange={next=>void toggle(key,next)}
        trackColor={{true:colors.primary,false:colors.border}}
        thumbColor="#FFFFFF"/>
    </View>;
  }
  return <Screen showHeader publicNav style={styles.page}>
    <View style={[styles.header,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("notifications.back")}
        onPress={()=>router.navigate("/notifications")} style={styles.back}>
        <Ionicons name={isRTL?"arrow-forward":"arrow-back"} size={22} color={colors.primary}/>
      </Pressable>
      <AppText variant="bodyLarge" weight="bold" style={{flex:1}}>{t("notifications.preferences")}</AppText>
    </View>

    {loading?<DataLoadingState variant="list" minHeight={400}/>:null}
    {error?<Card style={styles.notice}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} variant="secondary"
        onPress={()=>setRetry(value=>value+1)}/>
    </Card>:null}
    {!loading?<View style={styles.panel}>
      <View style={styles.sectionHeading}>
        <AppText variant="bodyLarge" weight="bold">{t("notifications.prefs.delivery")}</AppText>
        <AppText variant="caption" muted>{t("notifications.prefs.deliveryBody")}</AppText>
      </View>
      {delivery.map(row)}
    </View>:null}
    {!loading?<View style={styles.panel}>
      <View style={styles.sectionHeading}>
        <AppText variant="bodyLarge" weight="bold">{t("notifications.prefs.content")}</AppText>
        <AppText variant="caption" muted>{t("notifications.prefs.contentBody")}</AppText>
      </View>
      {content.map(row)}
    </View>:null}
    {!loading?<Card style={styles.notice}>
      <View style={[styles.info,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="information-circle-outline" color={colors.primary} size={22}/>
        <AppText variant="caption" muted style={{flex:1}}>
          {t("notifications.prefs.deviceHint")}
        </AppText>
      </View>
    </Card>:null}
  </Screen>;
}
const styles=StyleSheet.create({
  page:{paddingTop:spacing.md,gap:spacing.md},
  header:{alignItems:"center",gap:spacing.sm},
  back:{width:44,height:44,borderRadius:22,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  panel:{backgroundColor:colors.surface,borderColor:colors.border,borderWidth:1,
    borderRadius:radius.lg,overflow:"hidden"},
  sectionHeading:{padding:spacing.md,gap:4,backgroundColor:colors.surfaceMuted},
  setting:{padding:spacing.md,alignItems:"center",gap:spacing.sm,
    borderTopWidth:1,borderTopColor:colors.border},
  icon:{width:36,height:36,borderRadius:18,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  notice:{gap:spacing.sm},
  info:{gap:spacing.sm,alignItems:"flex-start"},
});
