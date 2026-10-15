import {colors,radius,spacing} from "@leaguekick/design-tokens";
import {router,usePathname} from "expo-router";
import {useCallback,useEffect,useRef} from "react";
import {Pressable,ScrollView,StyleSheet,type LayoutChangeEvent} from "react-native";
import {ownerDashboardSubsections,ownerSecondaryRoute,ownerSubsectionRoute}
  from "../../lib/owner-dashboard-navigation";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";

/** Navigates working section destinations only. Later phases can expand
 * bookings, competitions and marketing without adding fake empty tabs. */
export function OwnerManagementSubNav(){
  const pathname=usePathname();
  const section=ownerSecondaryRoute(pathname);
  const {t,isRTL}=useLocale();
  const scrollRef=useRef<ScrollView|null>(null);
  const viewport=useRef(0);
  const positions=useRef<Record<string,{x:number;width:number}>>({});
  const active=section?ownerSubsectionRoute(pathname,section):"";
  const focus=useCallback(()=>{
    const current=positions.current[active];
    if(!current||viewport.current<=0)return;
    scrollRef.current?.scrollTo({
      x:Math.max(0,current.x+current.width/2-viewport.current/2),
      animated:false,
    });
  },[active]);
  useEffect(()=>{const frame=requestAnimationFrame(focus);
    return()=>cancelAnimationFrame(frame);},[focus,isRTL]);
  if(!section)return null;
  const items=ownerDashboardSubsections[section];
  return <ScrollView
    testID="owner-phase1-subnav"
    ref={scrollRef} horizontal showsHorizontalScrollIndicator={false}
    onLayout={(event:LayoutChangeEvent)=>{viewport.current=event.nativeEvent.layout.width;focus();}}
    onContentSizeChange={focus}
    contentContainerStyle={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}
    style={styles.nav}
  >
    {items.map(item=>{
      const selected=active===item.key;
      return <Pressable key={item.key}
        testID={`owner-sub-${section}-${item.key}`}
        accessibilityRole="tab" accessibilityState={{selected}}
        accessibilityLabel={t(item.labelKey)}
        onLayout={event=>{const{x,width}=event.nativeEvent.layout;
          positions.current[item.key]={x,width};if(selected)focus();}}
        onPress={()=>{if(!selected)router.replace(item.href);}}
        style={[styles.item,selected&&styles.selected]}>
        <AppText variant="caption" weight="semibold" numberOfLines={1}
          style={selected?styles.label:undefined}>{t(item.labelKey)}</AppText>
      </Pressable>;
    })}
  </ScrollView>;
}
const styles=StyleSheet.create({
  nav:{flexGrow:0,borderBottomWidth:1,borderBottomColor:colors.border},
  row:{flexGrow:1,paddingVertical:spacing.sm,gap:spacing.sm,alignItems:"center"},
  item:{minHeight:44,borderRadius:radius.pill,paddingHorizontal:spacing.md,
    borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,
    alignItems:"center",justifyContent:"center"},
  selected:{backgroundColor:colors.primarySoft,borderColor:colors.primary},
  label:{color:colors.primary},
});
