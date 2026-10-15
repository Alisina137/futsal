import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import {router,usePathname} from "expo-router";
import {useCallback,useEffect,useRef} from "react";
import {Pressable,ScrollView,StyleSheet,type LayoutChangeEvent} from "react-native";
import {
  ownerDashboardSections,ownerSectionForPath,ownerRememberableSectionRoute,
  ownerSectionRoot,type OwnerDashboardSection,type OwnerRememberableRoute,
} from "../../lib/owner-dashboard-navigation";
import {useAuth} from "../../providers/AuthProvider";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";

export function OwnerTopNav(){
  const pathname=usePathname();
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const active=ownerSectionForPath(pathname);
  const scrollRef=useRef<ScrollView|null>(null);
  const viewportWidth=useRef(0);
  const contentWidth=useRef(0);
  const itemLayouts=useRef<Partial<Record<OwnerDashboardSection,{x:number;width:number}>>>({});
  // Persist only canonical, authorized navigation destinations within this
  // mounted owner shell. Never retain private screen URLs across accounts.
  const lastRoute=useRef<Partial<Record<OwnerDashboardSection,OwnerRememberableRoute>>>({});
  const lastUser=useRef(session?.user.id);
  if(lastUser.current!==session?.user.id){
    lastUser.current=session?.user.id;
    lastRoute.current={};
  }
  useEffect(()=>{
    const route=ownerRememberableSectionRoute(pathname);
    if(route)lastRoute.current[ownerSectionForPath(pathname)]=route;
  },[pathname]);

  const focusActive=useCallback((animated=false)=>{
    const layout=itemLayouts.current[active];
    const viewport=viewportWidth.current;
    if(!layout||viewport<=0)return;
    const maxX=Math.max(0,contentWidth.current-viewport);
    const centeredX=layout.x+(layout.width/2)-(viewport/2);
    const x=Math.max(0,Math.min(centeredX,maxX));
    scrollRef.current?.scrollTo({x,y:0,animated});
  },[active]);

  useEffect(()=>{
    const frame=requestAnimationFrame(()=>focusActive(false));
    return ()=>cancelAnimationFrame(frame);
  },[focusActive,isRTL]);

  function handleViewportLayout(event:LayoutChangeEvent){
    viewportWidth.current=event.nativeEvent.layout.width;
    focusActive(false);
  }
  function handleItemLayout(key:OwnerDashboardSection,event:LayoutChangeEvent){
    const {x,width}=event.nativeEvent.layout;
    itemLayouts.current[key]={x,width};
    if(key===active)focusActive(false);
  }
  return <ScrollView
    ref={scrollRef}
    testID="owner-phase1-main-nav"
    horizontal showsHorizontalScrollIndicator={false}
    onLayout={handleViewportLayout}
    onContentSizeChange={(width)=>{contentWidth.current=width;focusActive(false);}}
    style={styles.nav}
    contentContainerStyle={[styles.navContent,{flexDirection:isRTL?"row-reverse":"row"}]}
  >
    {ownerDashboardSections.map(item=>{
      const selected=active===item.key;
      return <Pressable
        key={item.key}
        testID={`owner-main-${item.key}`}
        accessibilityRole="tab"
        accessibilityState={{selected}}
        accessibilityLabel={t(item.labelKey)}
        onLayout={event=>handleItemLayout(item.key,event)}
        onPress={()=>{
          if(selected)return;
          const route=lastRoute.current[item.key]??ownerSectionRoot(item.key);
          router.replace(route);
        }}
        style={({pressed})=>[
          styles.item,selected&&styles.itemActive,
          pressed&&!selected&&styles.itemPressed,
        ]}
      >
        <Ionicons
          name={item.icon as keyof typeof Ionicons.glyphMap}
          size={18} color={selected?colors.primary:colors.textMuted}
        />
        <AppText variant="caption" weight={selected?"bold":"semibold"}
          numberOfLines={1} style={selected?styles.labelActive:undefined}>
          {t(item.labelKey)}
        </AppText>
      </Pressable>;
    })}
  </ScrollView>;
}

const styles=StyleSheet.create({
  nav:{flexGrow:0,flexShrink:0,marginHorizontal:-spacing.xs,
    borderTopWidth:1,borderBottomWidth:1,borderTopColor:colors.border,
    borderBottomColor:colors.border,backgroundColor:colors.background},
  navContent:{gap:spacing.sm,paddingHorizontal:spacing.xs,paddingVertical:spacing.xs,
    alignItems:"center",flexWrap:"nowrap"},
  item:{minHeight:44,paddingHorizontal:spacing.md,borderRadius:radius.pill,
    borderWidth:1,borderColor:"transparent",backgroundColor:colors.surface,
    flexDirection:"row",alignItems:"center",justifyContent:"center",gap:spacing.xs},
  itemActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  itemPressed:{borderColor:colors.border,backgroundColor:colors.surfaceMuted},
  labelActive:{color:colors.primary},
});
