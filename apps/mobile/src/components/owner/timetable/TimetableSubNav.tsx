import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { router, usePathname } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, type LayoutChangeEvent } from "react-native";
import { useLocale } from "../../../providers/LocaleProvider";
import { AppText } from "../../ui/AppText";

type TimetableSection="calendar"|"weekly"|"special";

const items:{
  key:TimetableSection;
  icon:keyof typeof Ionicons.glyphMap;
  labelKey:
    |"schedule.subnav.calendar"
    |"schedule.subnav.weekly"
    |"schedule.subnav.special";
  href:
    |"/owner/schedule"
    |"/owner/timetable/weekly"
    |"/owner/timetable/exceptions";
}[]=[
  {key:"calendar",icon:"calendar-outline",labelKey:"schedule.subnav.calendar",href:"/owner/schedule"},
  {key:"special",icon:"time-outline",labelKey:"schedule.subnav.special",href:"/owner/timetable/exceptions"},
  {key:"weekly",icon:"repeat-outline",labelKey:"schedule.subnav.weekly",href:"/owner/timetable/weekly"},
];

export function isTimetableRoute(pathname:string){
  return pathname.startsWith("/owner/schedule")
    ||pathname.startsWith("/owner/timetable")
    ||pathname.startsWith("/owner/manual-booking")
    ||pathname.startsWith("/owner/block-time");
}

function activeSection(pathname:string):TimetableSection{
  if(pathname.startsWith("/owner/manual-booking")||pathname.startsWith("/owner/block-time"))return "calendar";
  if(pathname.startsWith("/owner/timetable/exception"))return "special";
  if(pathname.startsWith("/owner/timetable/exceptions"))return "special";
  if(pathname.startsWith("/owner/timetable/weekly")||pathname.startsWith("/owner/timetable/edit"))return "weekly";
  return "calendar";
}

export function TimetableSubNav(){
  const pathname=usePathname();
  const {t,isRTL}=useLocale();
  const active=activeSection(pathname);
  const scrollRef=useRef<ScrollView|null>(null);
  const viewportWidth=useRef(0);
  const contentWidth=useRef(0);
  const itemLayouts=useRef<Partial<Record<TimetableSection,{x:number;width:number}>>>({});

  const focusActive=useCallback((animated=false)=>{
    const layout=itemLayouts.current[active];
    const viewport=viewportWidth.current;
    if(!layout||viewport<=0)return;
    const maxX=Math.max(0,contentWidth.current-viewport);
    const centeredX=layout.x+(layout.width/2)-(viewport/2);
    scrollRef.current?.scrollTo({x:Math.max(0,Math.min(centeredX,maxX)),y:0,animated});
  },[active]);

  useEffect(()=>{
    const frame=requestAnimationFrame(()=>focusActive(false));
    return ()=>cancelAnimationFrame(frame);
  },[focusActive]);

  function onViewport(event:LayoutChangeEvent){
    viewportWidth.current=event.nativeEvent.layout.width;
    focusActive(false);
  }

  return <ScrollView
    ref={scrollRef}
    horizontal
    showsHorizontalScrollIndicator={false}
    onLayout={onViewport}
    onContentSizeChange={(width)=>{contentWidth.current=width;focusActive(false);}}
    style={styles.nav}
    contentContainerStyle={[styles.content,{flexDirection:isRTL?"row-reverse":"row"}]}
  >
    {items.map((item)=>{
      const selected=active===item.key;
      return <Pressable
        key={item.key}
        accessibilityRole="tab"
        accessibilityState={{selected}}
        onLayout={(event)=>{
          const {x,width}=event.nativeEvent.layout;
          itemLayouts.current[item.key]={x,width};
          if(selected)focusActive(false);
        }}
        onPress={()=>{if(!selected)router.replace(item.href);}}
        style={({pressed})=>[
          styles.item,
          selected&&styles.itemActive,
          pressed&&!selected&&styles.itemPressed,
        ]}
      >
        <Ionicons name={item.icon} size={17} color={selected?colors.primary:colors.textMuted}/>
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
    backgroundColor:colors.background,
    borderBottomWidth:1,
    borderBottomColor:colors.border,
  },
  content:{
    gap:spacing.xs,
    paddingVertical:spacing.sm,
    alignItems:"center",
    flexWrap:"nowrap",
  },
  item:{
    minHeight:40,
    paddingHorizontal:spacing.md,
    borderRadius:radius.pill,
    borderWidth:1,
    borderColor:colors.border,
    backgroundColor:colors.surface,
    flexDirection:"row",
    alignItems:"center",
    gap:spacing.xs,
  },
  itemActive:{
    borderColor:colors.primary,
    backgroundColor:colors.primarySoft,
  },
  itemPressed:{backgroundColor:colors.surfaceMuted},
  labelActive:{color:colors.primary},
});