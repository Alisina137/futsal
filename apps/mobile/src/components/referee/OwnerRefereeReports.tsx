import {colors,spacing,radius} from "@leaguekick/design-tokens";
import {useCallback,useEffect,useState} from "react";
import {Pressable,View,StyleSheet} from "react-native";
import {refereePhase2Api,type OrganizerRefereeReport} from "../../lib/api";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {TextField} from "../ui/TextField";

export function OwnerRefereeReports({token,competitionId,onApproved}:{
  token:string;competitionId:string;onApproved:()=>void;
}){
  const {t}=useLocale();
  const tr=(key:string)=>t(("rf2."+key) as never);
  const [reports,setReports]=useState<OrganizerRefereeReport[]>([]);
  const [expanded,setExpanded]=useState<string|null>(null);
  const [feedback,setFeedback]=useState("");
  const [confirmImpact,setConfirmImpact]=useState(false);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const load=useCallback(async()=>{
    try{const result=await refereePhase2Api.organizerReports(token,competitionId);
      setReports(result.reports);setError(null);}
    catch(e){setError(e instanceof Error?e.message:tr("loadFailed"));}
  },[token,competitionId,t]);
  useEffect(()=>{void load();},[load]);
  async function review(matchId:string,action:"APPROVE"|"RETURN"){
    if(busy)return;
    setBusy(matchId);setError(null);
    try{
      await refereePhase2Api.review(token,matchId,action,feedback,confirmImpact);
      setExpanded(null);setFeedback("");setConfirmImpact(false);
      await load();if(action==="APPROVE")onApproved();
    }catch(e){setError(e instanceof Error?e.message:tr("actionFailed"));}
    finally{setBusy(null);}
  }
  return <View style={{gap:spacing.sm}}>
    <AppText variant="bodyLarge" weight="bold">{tr("ownerReports")}</AppText>
    <AppText variant="caption" muted>{tr("approvalHint")}</AppText>
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button variant="secondary" label={tr("retry")} onPress={()=>void load()}/></Card>:null}
    {reports.length===0?<Card><AppText muted>{tr("noReports")}</AppText></Card>:null}
    {reports.map(report=><Card key={report.matchId} style={{gap:spacing.sm}}>
      <View style={styles.header}>
        <View style={{flex:1,gap:spacing.xs}}>
          <AppText weight="bold">{report.refereeName}</AppText>
          <AppText variant="caption" muted>{tr("reportStatus")}: {tr("status."+report.status)}</AppText>
        </View>
        <AppText variant="title" weight="bold">
          {report.score.homeScore} : {report.score.awayScore}</AppText>
      </View>
      <Button label={expanded===report.matchId?tr("hideReport"):tr("viewReport")}
        variant="secondary" onPress={()=>{setExpanded(old=>old===report.matchId?null:report.matchId);
          setFeedback("");setConfirmImpact(false);}}/>
      {expanded===report.matchId?<View style={{gap:spacing.sm}}>
        <AppText weight="semibold">{tr("summary")}</AppText>
        <AppText muted>{report.summary||"—"}</AppText>
        <AppText weight="semibold">{tr("timeline")}</AppText>
        {report.events.map(event=><View key={event.id} style={styles.line}>
          <AppText>{tr("kind."+event.kind)} · {event.side?tr("side."+event.side):""}</AppText>
          <AppText variant="caption" muted>{tr("period")} {event.period} · {Math.floor(event.elapsedSeconds/60)}:{String(event.elapsedSeconds%60).padStart(2,"0")}</AppText>
          {event.details?<AppText variant="caption" muted>{event.details}</AppText>:null}
        </View>)}
        {report.status==="SUBMITTED"?<>
          <TextField label={tr("reviewFeedback")} value={feedback}
            onChangeText={setFeedback} maxLength={800}/>
          <Pressable accessibilityRole="checkbox" accessibilityState={{checked:confirmImpact}}
            onPress={()=>setConfirmImpact(v=>!v)} style={styles.header}>
            <AppText weight="semibold">{confirmImpact?"☑":"☐"} {tr("confirmImpact")}</AppText>
          </Pressable>
          <View style={styles.actions}>
            <Button label={tr("approveReport")} disabled={busy!==null}
              loading={busy===report.matchId}
              onPress={()=>void review(report.matchId,"APPROVE")}/>
            <Button label={tr("returnReport")} variant="secondary"
              disabled={busy!==null||feedback.trim().length<3}
              onPress={()=>void review(report.matchId,"RETURN")}/>
          </View>
        </>:null}
      </View>:null}
    </Card>)}
  </View>;
}
const styles=StyleSheet.create({
  header:{flexDirection:"row",alignItems:"center",gap:spacing.md},
  actions:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  line:{borderTopWidth:1,borderColor:colors.border,paddingVertical:spacing.sm,gap:spacing.xs},
});
