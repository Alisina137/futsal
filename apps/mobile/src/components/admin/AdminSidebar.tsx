import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,spacing} from "@leaguekick/design-tokens";
import {useEffect,useRef,useState} from "react";
import {Pressable,ScrollView,View} from "react-native";
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
  const navRef=useRef<ScrollView>(null);
  const positions=useRef(new Map<SectionKey,number>());
  const groupPositions=useRef(new Map<string,number>());
  // Keep the chosen section's group expanded and its label on-screen.
  const activeGroup=groups.find(g=>(g.sections as readonly string[]).includes(section))?.id;
  useEffect(()=>{
    if(!activeGroup)return;
    setCollapsed(previous=>previous.includes(activeGroup)
      ?previous.filter(id=>id!==activeGroup):previous);
    const frame=requestAnimationFrame(()=>{
      const y=(groupPositions.current.get(activeGroup)??0)+(positions.current.get(section)??0);
      if(y!==undefined)navRef.current?.scrollTo({y:Math.max(0,y-100),animated:true});
    });
    return()=>cancelAnimationFrame(frame);
  },[section,activeGroup,mobileOpen,desktop]);
  function toggle(id:string){
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
    {desktop||mobileOpen?<ScrollView ref={navRef} style={desktop?styles.adminNavScroll:{maxHeight:440,flexGrow:0}} contentContainerStyle={styles.adminNavGroups}
      keyboardShouldPersistTaps="handled">
      {groups.map(group=>{
        const open=!collapsed.includes(group.id);
        return <View key={group.id} style={{gap:4}} onLayout={e=>{groupPositions.current.set(group.id,e.nativeEvent.layout.y);}}>
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
            return <Pressable key={item.key} accessibilityRole="button"
              onLayout={event=>{positions.current.set(item.key,event.nativeEvent.layout.y);}}
              accessibilityState={{selected:active}} onPress={()=>{
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
