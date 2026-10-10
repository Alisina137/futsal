import {colors,spacing,radius} from "@leaguekick/design-tokens";
import {router} from "expo-router";
import {useCallback,useEffect,useState} from "react";
import {Linking,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {refereeCareerApi,type RefereeCareerResponse,type RefereeCareerWindow} from "../../lib/api";
import {formatRefereeScheduleParts} from "../../lib/date-time";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";

const filters:RefereeCareerWindow[]=["7d","30d","90d","year","all"];
function Tile({value,label}:{value:number|string;label:string}){
  return <View style={styles.tile}>
    <AppText variant="title" weight="bold" style={{color:colors.primary,textAlign:"center"}}>{value}</AppText>
    <AppText variant="body" weight="medium" style={styles.tileLabel}>{label}</AppText>
  </View>;
}
export function RefereeCareerPanel({token,section}:{token:string;section:"overview"|"history"|"performance"}){
 const {t,isRTL,language}=useLocale(),tr=(k:string)=>t(("rf3."+k) as never);
 const [period,setPeriod]=useState<RefereeCareerWindow>("all");
 const [result,setResult]=useState<RefereeCareerResponse|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
 const [busy,setBusy]=useState<string|null>(null);
 const [retry,setRetry]=useState(0);
 const load=useCallback(async()=>{
   setLoading(true);
   try{const value=await refereeCareerApi.career(token,period);setResult(value);setError(null);}
   catch(e){setError(e instanceof Error?e.message:tr("statsLoadError"));setResult(null);}
   finally{setLoading(false);}
 },[token,period,retry,t]);
 useEffect(()=>{void load();},[load]);
 async function pdf(matchId:string){
   setBusy(matchId);setError(null);
   try{
     const {token:ticket}=await refereeCareerApi.pdfTicket(token,matchId);
     await Linking.openURL(refereeCareerApi.pdfUrl(ticket));
   }catch(e){setError(e instanceof Error?e.message:tr("pdfError"));}
   finally{setBusy(null);}
 }
 const max=Math.max(1,...(result?.monthly??[]).map(m=>m.matches));
 return <View style={{gap:spacing.md}}>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0}}
     contentContainerStyle={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
     {filters.map(filter=><Pressable accessibilityRole="button" key={filter}
       accessibilityState={{selected:period===filter}}
       style={[styles.filter,period===filter&&styles.active]} onPress={()=>setPeriod(filter)}>
       <AppText weight="semibold" variant="caption"
         style={period===filter?{color:colors.primary}:undefined}>{tr("filter."+filter)}</AppText>
     </Pressable>)}
   </ScrollView>
   {error?<Card style={{gap:spacing.sm}}><AppText style={{color:colors.danger}}>{error}</AppText>
     <Button label={tr("retry")} variant="secondary" onPress={()=>setRetry(v=>v+1)}/></Card>:null}
   {loading?<DataLoadingState variant="dashboard" minHeight={250}/>:result?<>
     {section==="overview"?<>
       <View style={styles.grid}>
         <Tile value={result.total} label={tr("verifiedMatches")}/>
         <Tile value={result.competitionsCount} label={tr("competitions")}/>
         <Tile value={result.submitted} label={tr("reportsSubmitted")}/>
         <Tile value={result.onTimeRate+"%"} label={tr("onTimeRate")}/>
       </View>
       <Card style={{gap:spacing.md}}>
         <AppText variant="bodyLarge" weight="bold">{tr("verifiedActivity")}</AppText>
         <View style={styles.grid}>
           <Tile value={result.events.GOAL} label={tr("goalsRecorded")}/>
           <Tile value={result.events.YELLOW_CARD} label={tr("yellowCards")}/>
           <Tile value={result.events.RED_CARD} label={tr("redCards")}/>
           <Tile value={result.events.FOUL} label={tr("foulsRecorded")}/>
         </View>
         <AppText variant="caption" muted>{tr("verifiedOnly")}</AppText>
       </Card>
     </>:null}
     {section==="history"?<>
       {!result.history.length?<Card><AppText muted>{tr("noHistory")}</AppText></Card>:null}
       {result.history.map(item=><Card key={item.matchId} style={{gap:spacing.sm}}>
         <AppText weight="bold">{item.homeName} VS {item.awayName}</AppText>
         <AppText variant="title" weight="bold" forceLtr>{item.homeScore} – {item.awayScore}</AppText>
         <AppText variant="caption" muted>{item.competitionName} · {item.venueName}</AppText>
         {item.finishedAt?<View style={styles.historyDateTime}>
           <AppText variant="caption" muted>{formatRefereeScheduleParts(item.finishedAt,language).date}</AppText>
           <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
             {formatRefereeScheduleParts(item.finishedAt,language).time} · {tr("kabulTime")}
           </AppText>
         </View>:null}
         <View style={styles.actions}>
           <Button label={tr("details")} variant="secondary" onPress={()=>router.push({
             pathname:"/competitions/[competitionId]/matches/[matchId]",
             params:{competitionId:item.competitionId,matchId:item.matchId}})}/>
           <Button label={tr("downloadPdf")} disabled={busy!==null}
             loading={busy===item.matchId} onPress={()=>void pdf(item.matchId)}/>
         </View>
       </Card>)}
     </>:null}
     {section==="performance"?<>
       <Card style={{gap:spacing.md}}>
         <AppText variant="bodyLarge" weight="bold">{tr("monthlyActivity")}</AppText>
         <View style={styles.chart}>
           {result.monthly.map(({month,matches})=><View key={month} style={styles.column}>
             <AppText variant="caption" weight="bold" style={{color:colors.primary}}>{matches}</AppText>
             <View style={[styles.bar,{height:Math.max(4,94*matches/max)}]}/>
             <AppText variant="caption" muted style={styles.month}>{month.slice(5)}</AppText>
           </View>)}
         </View>
         <AppText variant="caption" muted>{tr("calendarHint")}</AppText>
       </Card>
       <View style={styles.grid}>
         <Tile value={result.submissionRate+"%"} label={tr("submissionRate")}/>
         <Tile value={result.onTimeRate+"%"} label={tr("onTimeRate")}/>
         <Tile value={result.events.TIMEOUT} label={tr("timeouts")}/>
         <Tile value={result.events.INCIDENT} label={tr("incidents")}/>
       </View>
       <Card style={{gap:spacing.sm}}>
         <AppText variant="bodyLarge" weight="bold">{tr("competitionBreakdown")}</AppText>
         {!result.competitions.length?<AppText muted>{tr("noHistory")}</AppText>:null}
         {result.competitions.map(c=><View key={c.id} style={styles.line}>
           <AppText style={{flex:1}}>{c.name}</AppText>
           <AppText weight="semibold">{c.matches}</AppText>
         </View>)}
         <AppText variant="caption" muted>{tr("verifiedOnly")}</AppText>
       </Card>
     </>:null}
   </>:null}
 </View>;
}
const styles=StyleSheet.create({
 grid:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
 tile:{flexGrow:1,flexBasis:"46%",minWidth:0,minHeight:112,alignItems:"center",
   justifyContent:"center",gap:spacing.sm,
   padding:spacing.md,backgroundColor:colors.surface,borderWidth:1,
   borderColor:colors.border,borderRadius:radius.md},
 tileLabel:{textAlign:"center",lineHeight:23,flexShrink:1},
 historyDateTime:{gap:spacing.xs,padding:spacing.sm,
   backgroundColor:colors.surfaceMuted,borderRadius:radius.md},
 filter:{minHeight:40,paddingHorizontal:spacing.md,justifyContent:"center",
   borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},
 active:{backgroundColor:colors.primarySoft,borderColor:colors.primary},
 actions:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
 chart:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-end",
   gap:2,minHeight:140},
 column:{flex:1,alignItems:"center",justifyContent:"flex-end",gap:4,minWidth:13},
 bar:{width:"80%",backgroundColor:colors.primary,borderTopLeftRadius:4,borderTopRightRadius:4},
 month:{fontSize:9},
 line:{flexDirection:"row",alignItems:"center",gap:spacing.sm,
   borderBottomWidth:1,borderBottomColor:colors.border,paddingVertical:spacing.sm},
});
