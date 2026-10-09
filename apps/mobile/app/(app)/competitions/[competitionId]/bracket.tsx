import {Redirect,useLocalSearchParams} from "expo-router";

/** Legacy link compatibility: retain the public URL while opening the new profile tab. */
export default function CompetitionBracketRedirect(){
  const {competitionId}=useLocalSearchParams<{competitionId:string}>();
  return <Redirect href={{pathname:"/competitions/[competitionId]",params:{
    competitionId,tab:"STANDINGS",stage:"KNOCKOUT"
  }}}/>;
}
