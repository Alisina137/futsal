import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,spacing} from "@leaguekick/design-tokens";
import {Redirect,router} from "expo-router";
import {useEffect,useState} from "react";
import {readDashboardRole,type DashboardRole} from "../../src/lib/dashboard-role";
import {View} from "react-native";
import {AppText} from "../../src/components/ui/AppText";
import {Button} from "../../src/components/ui/Button";
import {Card} from "../../src/components/ui/Card";
import {Screen} from "../../src/components/ui/Screen";
import {useAuth} from "../../src/providers/AuthProvider";
import {useLocale} from "../../src/providers/LocaleProvider";
import {TeamManagerDashboard} from "../../src/components/team-manager/TeamManagerDashboard";
import {PlayerDashboard} from "../../src/components/player/PlayerDashboard";
import {RefereeDashboard} from "../../src/components/referee/RefereeDashboard";

export default function DashboardScreen(){
  const {session}=useAuth(),{t}=useLocale();
  const roles=session?.user.roles??[];
  const [preferred,setPreferred]=useState<DashboardRole|null>(null);
  const [ready,setReady]=useState(false);
  const userId=session?.user.id;
  useEffect(()=>{
    let active=true;
    setReady(false);setPreferred(null);
    if(!userId){setReady(true);return()=>{active=false;};}
    void readDashboardRole(userId).then(value=>{if(active)setPreferred(value);})
      .finally(()=>{if(active)setReady(true);});
    return()=>{active=false;};
  },[userId]);
  if(!ready)return <Screen showHeader><View><AppText muted>{t("rf1.loadingDashboard")}</AppText></View></Screen>;
  if(roles.includes("PLATFORM_ADMIN"))return <Redirect href="/admin"/>;
  // The hamburger still has exactly one Dashboard item; selection is stored per account.
  if(preferred==="PLAYER")return <PlayerDashboard/>;
  if(preferred==="REFEREE"&&roles.includes("REFEREE"))return <RefereeDashboard/>;
  if(preferred==="VENUE_OWNER"&&roles.includes("VENUE_OWNER"))return <Redirect href="/owner/competitions"/>;
  if(preferred==="TEAM_MANAGER"&&roles.includes("TEAM_MANAGER"))return <TeamManagerDashboard/>;
  if(roles.includes("VENUE_OWNER"))return <Redirect href="/owner/competitions"/>;
  if(roles.includes("TEAM_MANAGER"))return <TeamManagerDashboard/>;
  // Normal accounts have the free player dashboard even without an explicit PLAYER role.
  if(!roles.includes("REFEREE")||roles.includes("PLAYER"))return <PlayerDashboard/>;
  return <RefereeDashboard/>;
}
