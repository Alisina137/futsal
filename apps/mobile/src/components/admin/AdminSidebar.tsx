import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,spacing} from "@leaguekick/design-tokens";
import {useState} from "react";
import {Pressable,ScrollView,View} from "react-native";
import {AppText} from "../ui/AppText";
import {styles} from "./AdminStyles";
import {adminNavItems,type SectionKey} from "./admin-navigation";

const groups=[
  {id:"overview",label:"Overview",icon:"grid-outline",sections:["dashboard"]},
  {id:"management",label:"Management",icon:"layers-outline",sections:["users","venues","manualTeams"]},
  {id:"commercial",label:"Revenue",icon:"wallet-outline",sections:["subscriptions"]},
  {id:"platform",label:"Platform",icon:"settings-outline",sections:["configuration","support","moderation","audit"]},
] as const;

export function AdminSidebar({
  desktop,isRTL,section,onSelect,displayName,username,onSignOut,t,
}:{
  desktop:boolean;isRTL:boolean;section:SectionKey;
  onSelect:(section:SectionKey)=>void;
  displayName:string;username:string;onSignOut:()=>void;
  t:(key:any,params?:Record<string,string|number>)=>string;
}){
  const [mobileOpen,setMobileOpen]=useState(false);
  const [collapsed,setCollapsed]=useState<string[]>([]);
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
    {desktop||mobileOpen?<ScrollView style={desktop?styles.adminNavScroll:{maxHeight:440,flexGrow:0}} contentContainerStyle={styles.adminNavGroups}
      keyboardShouldPersistTaps="handled">
      {groups.map(group=>{
        const open=!collapsed.includes(group.id);
        return <View key={group.id} style={{gap:4}}>
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
              accessibilityState={{selected:active}} onPress={()=>{
                onSelect(item.key);if(!desktop)setMobileOpen(false);
              }} style={({pressed})=>[styles.navItem,
                {flexDirection:rowDirection,backgroundColor:active?"#17447A":"transparent"},
                pressed&&styles.navItemPressed]}>
              <Ionicons name={item.icon} size={20} color={active?"#FFFFFF":"#AFC5E8"}/>
              <AppText weight={active?"bold":"medium"}
                style={{color:active?"#FFFFFF":"#DCE8FA",flex:1}}>{t(item.labelKey as never)}</AppText>
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
