import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {OwnerOnboardingStatus} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useRef,useState} from "react";
import {Pressable,StyleSheet,View} from "react-native";
import {ApiRequestError,ownerApi} from "../../lib/api";
import {useAuth} from "../../providers/AuthProvider";
import {useLocale} from "../../providers/LocaleProvider";
import {OwnerPendingBookings} from "./OwnerPendingBookings";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";
import {Screen} from "../ui/Screen";

/** Phase 1: real, server-backed entry point; Phase 2 adds Today KPIs and the
 * Action Center without duplicating billing or booking business calculations. */
export function OwnerDashboard(){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const token=session?.accessToken;
  const [status,setStatus]=useState<OwnerOnboardingStatus|null>(null);
  const [loadedToken,setLoadedToken]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const generation=useRef(0);
  const liveStatus=loadedToken===token?status:null;

  const load=useCallback(async()=>{
    const request=++generation.current;
    if(!token){setStatus(null);setLoadedToken(null);setLoading(false);return;}
    setLoading(true);setError(null);
    try{
      const result=await ownerApi.getStatus(token);
      if(request!==generation.current)return;
      setStatus(result);setLoadedToken(token);
    }catch(cause){
      if(request!==generation.current)return;
      setError(cause instanceof ApiRequestError&&cause.isNetworkError
        ?t("owner.networkError"):t("owner.loadError"));
    }finally{if(request===generation.current)setLoading(false);}
  },[token,t]);

  useFocusEffect(useCallback(()=>{
    void load();
    return()=>{generation.current++;};
  },[load]));

  const links=[
    {key:"bookings",icon:"receipt-outline",label:"owner.dashboardNav.bookings",href:"/owner/bookings"},
    {key:"schedule",icon:"calendar-outline",label:"owner.dashboardNav.schedule",href:"/owner/schedule"},
    {key:"competitions",icon:"trophy-outline",label:"owner.dashboardNav.competitions",href:"/owner/competitions"},
    {key:"analysis",icon:"stats-chart-outline",label:"owner.dashboardNav.analysis",href:"/owner/analytics"},
  ] as const;

  if(loading&&!liveStatus)return <Screen embedded>
    <DataLoadingState variant="dashboard" minHeight={400}/>
  </Screen>;
  return <Screen embedded>
    <View testID="owner-phase1-overview" style={styles.hero}>
      <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.heroIcon}><Ionicons name="business-outline" color="#FFFFFF" size={26}/></View>
        <View style={{flex:1,gap:3}}>
          <AppText weight="bold" variant="title" style={{color:"#FFFFFF"}}>
            {t("owner.dashboardTitle")}
          </AppText>
          <AppText style={{color:"#E0EAFF"}}>{t("owner.dashboardSubtitle")}</AppText>
        </View>
      </View>
    </View>

    {error?<Card style={styles.stack}>
      <AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} variant="secondary" onPress={()=>void load()}/>
    </Card>:null}

    {liveStatus?.venue?<View style={styles.stack}>
      <AppText weight="bold" variant="bodyLarge">{t("owner.phase1.quickAccess")}</AppText>
      <View style={[styles.quickGrid,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {links.map(item=><Pressable key={item.key}
          testID={`owner-phase1-shortcut-${item.key}`} accessibilityRole="button"
          accessibilityLabel={t(item.label)} style={styles.quickLink}
          onPress={()=>router.push(item.href)}>
          <Ionicons name={item.icon} size={22} color={colors.primary}/>
          <AppText variant="caption" weight="semibold" style={{textAlign:"center"}}>{t(item.label)}</AppText>
        </Pressable>)}
      </View>
      <OwnerPendingBookings token={token} compact/>
    </View>:null}

    {!liveStatus?.venue&&!error?<Card style={styles.stack}>
      <AppText weight="semibold" style={{color:colors.primary}}>{t("owner.setupRequiredTitle")}</AppText>
      <AppText>{t("owner.setupRequiredBody")}</AppText>
      <Button label={t("owner.startSetup")} onPress={()=>router.push("/owner/onboarding")}/>
    </Card>:null}

    {liveStatus?.subscription.state==="EXPIRED"?<Card style={styles.stack}>
      <AppText weight="semibold" style={{color:colors.warning}}>{t("owner.trialExpiredTitle")}</AppText>
      <AppText>{t("owner.trialExpiredBody")}</AppText>
      <Button variant="secondary" label={t("venueSettings.manageSubscription")}
        onPress={()=>router.push("/owner/subscription")}/>
    </Card>:null}
  </Screen>;
}
const styles=StyleSheet.create({
  stack:{gap:spacing.md},
  hero:{backgroundColor:colors.primary,borderRadius:radius.lg,padding:spacing.lg},
  heading:{gap:spacing.md,alignItems:"center"},
  heroIcon:{width:52,height:52,borderRadius:radius.md,
    backgroundColor:"#FFFFFF29",alignItems:"center",justifyContent:"center"},
  quickGrid:{flexWrap:"wrap",gap:spacing.sm},
  quickLink:{width:"48%",minHeight:93,padding:spacing.sm,
    alignItems:"center",justifyContent:"center",gap:spacing.xs,
    borderRadius:radius.md,borderWidth:1,borderColor:colors.border,
    backgroundColor:colors.surface},
});
