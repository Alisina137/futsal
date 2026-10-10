import {Redirect} from "expo-router";
import {useAuth} from "../../../src/providers/AuthProvider";
import {RefereeDashboard} from "../../../src/components/referee/RefereeDashboard";
export default function RefereeDashboardRoute(){
  const {session}=useAuth();
  return session?.user.roles.includes("REFEREE")?<RefereeDashboard/>:<Redirect href="/dashboard"/>;
}
