import {Redirect} from "expo-router";
import {useAuth} from "../../../src/providers/AuthProvider";
import {PlayerDashboard} from "../../../src/components/player/PlayerDashboard";

/** Referees can no longer open Player mode via the legacy direct URL. */
export default function PlayerDashboardScreen(){
  const {session}=useAuth();
  const roles=session?.user.roles??[];
  if(roles.includes("REFEREE"))return <Redirect href="/dashboard/referee"/>;
  // A direct/legacy deep link must never bypass the assigned PLAYER role.
  if(!roles.includes("PLAYER"))return <Redirect href="/dashboard"/>;
  return <PlayerDashboard/>;
}
