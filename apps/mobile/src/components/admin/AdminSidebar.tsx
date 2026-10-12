import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,spacing} from "@leaguekick/design-tokens";
import {useCallback,useEffect,useRef,useState} from "react";
import {Pressable,ScrollView,View,type LayoutChangeEvent} from "react-native";
import {AppText} from "../ui/AppText";
import {styles} from "./AdminStyles";
import {adminNavItems,type SectionKey} from "./admin-navigation";
import {adminPhase4Label} from "./admin-phase4-labels";
import {useLocale} from "../../providers/LocaleProvider";

const groups=[
  {id:"overview",label:"Overview",icon:"grid-outline",sections:["dashboard","analytics"]},
  {id:"management",label:"Management",icon:"layers-outline",sections:["users","venues","manualTeams","teams","competitions","referees","reservations"]},
  {id:"commercial",label:"Revenue",icon:"wallet-outline",sections:["subscriptions"]},
  {id:"platform",label:"Platform",icon:"settings-outline",sections:["cases","moderation","reports","support","announcements","deliveries","configuration","audit","readiness"]},
] as const;

export function AdminSidebar({
  desktop,isRTL,section,onSelect,displayName,username,onSignOut,t,
}:{
  desktop:boolean;isRTL:boolean;section:SectionKey;
  onSelect:(section:SectionKey)=>void;
  displayName:string;username:string;onSignOut:()=>void;
  t:(key:any,params?:Record<string,string|number>)=>string;
}){
  const {language}=useLocale();
  const [mobileOpen,setMobileOpen]=useState(false);
  const [collapsed,setCollapsed]=useState<string[]>([]);
  const sidebarScroll=useRef<ScrollView|null>(null);
  const viewport=useRef(0),content=useRef(0);
  const groupY=useRef<Record<string,number>>({});
  const itemFrame=useRef<Record<string,{y:number;height:number}>>({});
  const selectedGroup=groups.find(group=>(group.sections as readonly string[]).includes(section))?.id
    ??groups[0].id;
  const focusSelected=useCallback((animated=false)=>{
    if(!desktop&&!mobileOpen)return;
    const groupTop=groupY.current[selectedGroup];
    const frame=itemFrame.current[section];
    if(groupTop===undefined||!frame||viewport.current<=0)return;
    const center=groupTop+frame.y+frame.height/2-viewport.current/2;
    sidebarScroll.current?.scrollTo({
      x:0,y:Math.max(0,Math.min(center,Math.max(0,content.current-viewport.current))),
      animated,
    });
  },[desktop,mobileOpen,section,selectedGroup]);
  useEffect(()=>{
    // Never hide the active destination inside a collapsed sidebar section.
    setCollapsed(previous=>previous.includes(selectedGroup)
      ?previous.filter(id=>id!==selectedGroup):previous);
    const frame=requestAnimationFrame(()=>focusSelected(false));
    return()=>cancelAnimationFrame(frame);
  },[selectedGroup,section,desktop,mobileOpen,focusSelected]);
  function toggle(id:string){
    if(id===selectedGroup)return; // the selected tab must remain visible
    setCollapsed(previous=>previous.includes(id)?previous.filter(x=>x!==id):[...previous,id]);
  }
  const rowDirection=isRTL?"row-reverse" as const:"row" as const;
  return <View style={[styles.sidebar,desktop?styles.sidebarDesktop:styles.sidebarCompact]}>
    <View style={[styles.brand,{flexDirection:rowDirection}]}>
      <View style={styles.brandMark}><Ionicons name="football" size={24} color="#FFFFFF"/></View>
      <View style={{flex:1,minWidth:0}}>
        <AppText variant="bodyLarge" weight="bold" style={{color:"#FFFFFF"}}>Futsal Admin</AppText>
        <AppText variant="caption" style={{color:"#AFC5E8"}}>{t("phase7.admin.subtitle")}</AppText>
      </View>
      {!desktop?<Pressable onPress={()=>setMobileOpen(x=>!x)} accessibilityRole="button"
        accessibilityLabel={t("phase7.admin.nav.menu")}
        accessibilityState={{expanded:mobileOpen}}
        style={styles.adminMenuButton}>
        <Ionicons name={mobileOpen?"close":"menu"} color="#FFFFFF" size={25}/>
      </Pressable>:null}
    </View>
    {desktop||mobileOpen?<ScrollView ref={sidebarScroll}
      style={desktop?styles.adminNavScroll:{maxHeight:440,flexGrow:0}}
      onLayout={e=>{viewport.current=e.nativeEvent.layout.height;focusSelected(false);}}
      onContentSizeChange={(_w,h)=>{content.current=h;focusSelected(false);}}
      contentContainerStyle={styles.adminNavGroups} keyboardShouldPersistTaps="handled">
      {groups.map(group=>{
        const open=!collapsed.includes(group.id);
        return <View key={group.id} style={{gap:4}}
          onLayout={(e:LayoutChangeEvent)=>{groupY.current[group.id]=e.nativeEvent.layout.y;focusSelected(false);}}>
          <Pressable onPress={()=>toggle(group.id)}
            accessibilityRole="button" accessibilityState={{expanded:open}}
            style={[styles.adminGroupHeader,{flexDirection:rowDirection}]}>
            <Ionicons name={group.icon} size={16} color="#AFC5E8"/>
            <AppText variant="caption" weight="bold"
              style={{color:"#AFC5E8",flex:1}}>{t(("phase7.admin.nav."+group.id) as never)}</AppText>
            <Ionicons name={open?"chevron-up":"chevron-down"} size={16} color="#AFC5E8"/>
          </Pressable>
          {open?adminNavItems.filter(item=>(group.sections as readonly string[]).includes(item.key)).map(item=>{
            const active=item.key===section;
            return <Pressable key={item.key} accessibilityRole="tab"
              accessibilityState={{selected:active}}
              onLayout={(e:LayoutChangeEvent)=>{
                itemFrame.current[item.key]={y:e.nativeEvent.layout.y,height:e.nativeEvent.layout.height};
                if(active)focusSelected(false);
              }}
              onPress={()=>{
                onSelect(item.key);if(!desktop)setMobileOpen(false);
              }} style={({pressed})=>[styles.navItem,
                {flexDirection:rowDirection,backgroundColor:active?"#17447A":"transparent"},
                pressed&&styles.navItemPressed]}>
              <Ionicons name={item.icon} size={20} color={active?"#FFFFFF":"#AFC5E8"}/>
              <AppText weight={active?"bold":"medium"}
                style={{color:active?"#FFFFFF":"#DCE8FA",flex:1}}>{adminPhase4Label(item.key,language)??t(item.labelKey as never)}</AppText>
              {active?<View style={styles.adminActiveDot}/>:null}
            </Pressable>;
          }):null}
        </View>;
      })}
    </ScrollView>:null}
    {desktop||mobileOpen?<View style={styles.sidebarFooter}>
      <View style={[styles.adminIdentity,{flexDirection:rowDirection}]}>
        <View style={styles.avatar}><Ionicons name="person" size={18} color={colors.primary}/></View>
        <View style={{flex:1}}>
          <AppText weight="semibold" style={{color:"#FFFFFF"}}>{displayName}</AppText>
          {username?<AppText variant="caption" style={{color:"#AFC5E8"}} forceLtr>@{username}</AppText>:null}
        </View>
      </View>
      <Pressable style={[styles.sidebarSignOut,{flexDirection:rowDirection}]} accessibilityRole="button"
        onPress={onSignOut}>
        <Ionicons name="log-out-outline" size={19} color="#FCA5A5"/>
        <AppText weight="semibold" style={{color:"#FCA5A5"}}>{t("common.signOut")}</AppText>
      </Pressable>
    </View>:null}
  </View>;
}
