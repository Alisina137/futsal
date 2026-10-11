import {Redirect} from "expo-router";
import {useAuth} from "../../../src/providers/AuthProvider";
import {PlayerDashboard} from "../../../src/components/player/PlayerDashboard";

/** Referees can no longer open Player mode via the legacy direct URL. */
export default function PlayerDashboardScreen(){
  const {session}=useAuth();
  if(session?.user.roles.includes("REFEREE"))return <Redirect href="/dashboard/referee"/>;
  return <PlayerDashboard/>;
}
