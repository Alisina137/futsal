import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { router, usePathname } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, type LayoutChangeEvent } from "react-native";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "../ui/AppText";

type OwnerSection="competitions"|"manualTeams"|"schedule"|"media"|"analysis"|"settings";

const items:{
  key:OwnerSection;
  icon:keyof typeof Ionicons.glyphMap;
  labelKey:
    |"owner.dashboardNav.competitions"
    |"manualTeams.title"
    |"owner.dashboardNav.schedule"
    |"owner.dashboardNav.posts"
    |"owner.dashboardNav.analysis"
    |"owner.dashboardNav.settings";
  href:"/owner/manual-teams"|"/owner/competitions"|"/owner/schedule"|"/owner/posts"|"/owner/analytics"|"/owner/settings";
}[]=[
  {key:"competitions",icon:"trophy-outline",labelKey:"owner.dashboardNav.competitions",href:"/owner/competitions"},
  {key:"manualTeams",icon:"people-circle-outline",labelKey:"manualTeams.title",href:"/owner/manual-teams"},
  {key:"schedule",icon:"calendar-outline",labelKey:"owner.dashboardNav.schedule",href:"/owner/schedule"},
  {key:"media",icon:"images-outline",labelKey:"owner.dashboardNav.posts",href:"/owner/posts"},
  {key:"analysis",icon:"stats-chart-outline",labelKey:"owner.dashboardNav.analysis",href:"/owner/analytics"},
  {key:"settings",icon:"settings-outline",labelKey:"owner.dashboardNav.settings",href:"/owner/settings"},
];

function activeSection(pathname:string):OwnerSection|null{
  if(pathname==="/dashboard"||pathname.startsWith("/owner/competitions"))return "competitions";
  if(pathname.startsWith("/owner/manual-teams"))return "manualTeams";
  if(pathname.startsWith("/owner/schedule")||pathname.startsWith("/owner/timetable")||pathname.startsWith("/owner/manual-booking")||pathname.startsWith("/owner/block-time"))return "schedule";
  if(pathname.startsWith("/owner/posts")||pathname.startsWith("/owner/promotions"))return "media";
  if(pathname.startsWith("/owner/analytics"))return "analysis";
  if(pathname.startsWith("/owner/settings")||pathname.startsWith("/owner/onboarding")||pathname.startsWith("/owner/subscription")||pathname.startsWith("/owner/referees"))return "settings";
  return null;
}

export function OwnerTopNav(){
  const pathname=usePathname();
  const {t,isRTL}=useLocale();
  const active=activeSection(pathname);
  const scrollRef=useRef<ScrollView|null>(null);
  const viewportWidth=useRef(0);
  const contentWidth=useRef(0);
  const itemLayouts=useRef<Partial<Record<OwnerSection,{x:number;width:number}>>>({});

  const focusActive=useCallback((animated=false)=>{
    if(!active)return;
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
  },[focusActive]);

  function handleViewportLayout(event:LayoutChangeEvent){
    viewportWidth.current=event.nativeEvent.layout.width;
    focusActive(false);
  }

  function handleItemLayout(key:OwnerSection,event:LayoutChangeEvent){
    const {x,width}=event.nativeEvent.layout;
    itemLayouts.current[key]={x,width};
    if(key===active)focusActive(false);
  }

  return <ScrollView
    ref={scrollRef}
    onLayout={handleViewportLayout}
    onContentSizeChange={(width)=>{
      contentWidth.current=width;
      focusActive(false);
    }}
    horizontal
    showsHorizontalScrollIndicator={false}
    style={styles.nav}
    contentContainerStyle={[
      styles.navContent,
      {flexDirection:isRTL?"row-reverse":"row"},
    ]}
  >
    {items.map((item)=>{
      const selected=active===item.key;
      return <Pressable
        key={item.key}
        accessibilityRole="tab"
        accessibilityState={{selected}}
        accessibilityLabel={t(item.labelKey)}
        onLayout={(event)=>handleItemLayout(item.key,event)}
        onPress={()=>{
          if(!selected){
            const layout=itemLayouts.current[item.key];
            const viewport=viewportWidth.current;
            if(layout&&viewport>0){
              const maxX=Math.max(0,contentWidth.current-viewport);
              const centeredX=layout.x+(layout.width/2)-(viewport/2);
              scrollRef.current?.scrollTo({
                x:Math.max(0,Math.min(centeredX,maxX)),
                y:0,
                animated:true,
              });
            }
            router.replace(item.href);
          }
        }}
        style={({pressed})=>[
          styles.item,
          selected&&styles.itemActive,
          pressed&&!selected&&styles.itemPressed,
        ]}
      >
        <Ionicons
          name={item.icon}
          size={18}
          color={selected?colors.primary:colors.textMuted}
        />
        <AppText
          variant="caption"
          weight={selected?"bold":"semibold"}
          numberOfLines={1}
          style={selected?styles.labelActive:undefined}
        >
          {t(item.labelKey)}
        </AppText>
      </Pressable>;
    })}
  </ScrollView>;
}

const styles=StyleSheet.create({
  nav:{
    flexGrow:0,
    flexShrink:0,
    marginHorizontal:-spacing.xs,
    borderTopWidth:1,
    borderBottomWidth:1,
    borderTopColor:colors.border,
    borderBottomColor:colors.border,
    backgroundColor:colors.background,
  },
  navContent:{
    gap:spacing.sm,
    paddingHorizontal:spacing.xs,
    paddingVertical:spacing.xs,
    alignItems:"center",
    flexWrap:"nowrap",
  },
  item:{
    height:44,
    paddingHorizontal:spacing.md,
    borderRadius:radius.pill,
    borderWidth:1,
    borderColor:"transparent",
    backgroundColor:colors.surface,
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"center",
    gap:spacing.xs,
  },
  itemActive:{
    borderColor:colors.primary,
    backgroundColor:colors.primarySoft,
  },
  itemPressed:{
    borderColor:colors.border,
    backgroundColor:colors.surfaceMuted,
  },
  labelActive:{
    color:colors.primary,
  },
});