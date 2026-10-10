import AsyncStorage from "@react-native-async-storage/async-storage";
export type DashboardRole="PLAYER"|"REFEREE"|"TEAM_MANAGER"|"VENUE_OWNER";
const pref=(userId:string)=>"futsal.dashboard.role.v1:"+userId;
export async function readDashboardRole(userId:string):Promise<DashboardRole|null>{
  try{
    const role=await AsyncStorage.getItem(pref(userId));
    return role==="PLAYER"||role==="REFEREE"||role==="TEAM_MANAGER"||role==="VENUE_OWNER"?role:null;
  }catch{return null;}
}
export async function setDashboardRole(userId:string,role:DashboardRole){
  await AsyncStorage.setItem(pref(userId),role);
}
