import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { CompetitionCreateRequest, CompetitionFormat } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { competitionApi } from "../../../../src/lib/api";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { DateTimePickerField } from "../../../../src/components/ui/DateTimePickerField";
import { OwnerTopNav } from "../../../../src/components/owner/OwnerTopNav";
import { Screen } from "../../../../src/components/ui/Screen";
import { TextField } from "../../../../src/components/ui/TextField";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

const formats:CompetitionFormat[]=["LEAGUE","KNOCKOUT","GROUP_KNOCKOUT"];
const THREE_DAYS_MS=72*60*60*1000;

function after(value:string,offsetMs:number){
  const parsed=Date.parse(value);
  return Number.isFinite(parsed)?new Date(parsed+offsetMs):undefined;
}

export default function CreateCompetitionScreen(){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const [name,setName]=useState("");
  const [description,setDescription]=useState("");
  const [format,setFormat]=useState<CompetitionFormat>("LEAGUE");
  const [maxTeams,setMaxTeams]=useState("8");
  const [fee,setFee]=useState("0");
  const [groupCount,setGroupCount]=useState("2");
  const [qualifiers,setQualifiers]=useState("2");
  const [registrationClosesAt,setRegistrationClosesAt]=useState("");
  const [startsAt,setStartsAt]=useState("");
  const [endsAt,setEndsAt]=useState("");
  const [matchDuration,setMatchDuration]=useState("60");
  const [winPoints,setWinPoints]=useState("3");
  const [drawPoints,setDrawPoints]=useState("1");
  const [lossPoints,setLossPoints]=useState("0");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  async function submit(){
    if(!session)return;
    const max=Number(maxTeams);
    const registrationFeeAfn=Number(fee);
    const groups=Number(groupCount);
    const qualified=Number(qualifiers);
    const duration=Number(matchDuration);
    const win=Number(winPoints);
    const draw=Number(drawPoints);
    const loss=Number(lossPoints);
    if(
      !name.trim()
      ||!Number.isInteger(max)||max<2
      ||!Number.isInteger(registrationFeeAfn)||registrationFeeAfn<0
      ||!Number.isInteger(duration)||duration<20||duration>180
      ||![win,draw,loss].every((value)=>Number.isInteger(value)&&value>=0&&value<=20)
      ||(format==="GROUP_KNOCKOUT"&&(!Number.isInteger(groups)||groups<2||!Number.isInteger(qualified)||qualified<1))
    ){
      setError(t("competition.createError"));return;
    }

    const deadlineMs=registrationClosesAt?Date.parse(registrationClosesAt):null;
    const startMs=startsAt?Date.parse(startsAt):null;
    const endMs=endsAt?Date.parse(endsAt):null;
    if(deadlineMs!==null&&deadlineMs<Date.now()+THREE_DAYS_MS){
      setError(t("competition.schedule.deadlineMin"));return;
    }
    if(deadlineMs!==null&&startMs!==null&&startMs<=deadlineMs){
      setError(t("competition.schedule.startAfterDeadline"));return;
    }
    if(startMs!==null&&endMs!==null&&endMs<=startMs){
      setError(t("competition.schedule.endAfterStart"));return;
    }

    const input:CompetitionCreateRequest={
      name:name.trim(),
      description:description.trim(),
      format,
      maxTeams:max,
      registrationFeeAfn,
      winPoints:win,
      drawPoints:draw,
      lossPoints:loss,
      tieBreakOrder:["POINTS","GOAL_DIFFERENCE","GOALS_FOR","HEAD_TO_HEAD","ADMIN"],
      groupCount:format==="GROUP_KNOCKOUT"?groups:null,
      qualifiersPerGroup:format==="GROUP_KNOCKOUT"?qualified:null,
      registrationClosesAt:registrationClosesAt.trim()||null,
      matchDurationMinutes:duration,
      startsAt:startsAt.trim()||null,
      endsAt:endsAt.trim()||null,
    };

    setBusy(true);setError(null);
    try{
      const {competition}=await competitionApi.create(session.accessToken,input);
      router.replace({pathname:"/owner/competitions/[competitionId]/manage",params:{competitionId:competition.id}});
    }catch{setError(t("competition.createError"));}
    finally{setBusy(false);}
  }

  return <Screen showHeader>
    <OwnerTopNav/>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("competition.createTitle")}</AppText>
      <AppText muted>{t("competition.control.createSubtitle")}</AppText>
    </View>

    <Card style={{gap:spacing.md}}>
      <AppText variant="bodyLarge" weight="bold">{t("competition.control.identity")}</AppText>
      <TextField label={t("competition.name")} value={name} onChangeText={setName}/>
      <TextField label={t("competition.description")} value={description} onChangeText={setDescription} multiline/>

      <AppText weight="semibold">{t("competition.format")}</AppText>
      <View style={{flexDirection:isRTL?"row-reverse":"row",flexWrap:"wrap",gap:spacing.sm}}>
        {formats.map((value)=><Pressable
          key={value}
          onPress={()=>setFormat(value)}
          style={{
            paddingHorizontal:spacing.md,paddingVertical:spacing.sm,borderRadius:radius.pill,borderWidth:1,
            borderColor:format===value?colors.primary:colors.border,
            backgroundColor:format===value?colors.primarySoft:colors.surface,
          }}
        >
          <AppText weight="semibold" style={format===value?{color:colors.primary}:undefined}>
            {t(`competition.format.${value}` as never)}
          </AppText>
        </Pressable>)}
      </View>

      <TextField label={t("competition.maxTeams")} value={maxTeams} onChangeText={setMaxTeams} keyboardType="number-pad" forceLtr/>
      <TextField label={t("competition.registrationFee")} value={fee} onChangeText={setFee} keyboardType="number-pad" forceLtr/>

      {format==="GROUP_KNOCKOUT"?<View style={{gap:spacing.md}}>
        <TextField label={t("competition.groupCount")} value={groupCount} onChangeText={setGroupCount} keyboardType="number-pad" forceLtr/>
        <TextField label={t("competition.qualifiersPerGroup")} value={qualifiers} onChangeText={setQualifiers} keyboardType="number-pad" forceLtr/>
      </View>:null}
    </Card>

    <Card style={{gap:spacing.md}}>
      <AppText variant="bodyLarge" weight="bold">{t("competition.control.scheduleRules")}</AppText>
      <DateTimePickerField
        label={t("competition.registrationDeadline")}
        value={registrationClosesAt}
        onChange={setRegistrationClosesAt}
        minimumDate={new Date(Date.now()+THREE_DAYS_MS)}
        hint={t("competition.schedule.deadlineMin")}
      />
      <DateTimePickerField
        label={t("competition.startsAt")}
        value={startsAt}
        onChange={setStartsAt}
        minimumDate={registrationClosesAt?after(registrationClosesAt,60_000):undefined}
        hint={t("competition.schedule.startAfterDeadline")}
      />
      <DateTimePickerField
        label={t("competition.endsAt")}
        value={endsAt}
        onChange={setEndsAt}
        minimumDate={startsAt?after(startsAt,60_000):undefined}
        hint={t("competition.schedule.endAfterStart")}
      />
      <TextField label={t("competition.matchDuration")} value={matchDuration} onChangeText={setMatchDuration} keyboardType="number-pad" forceLtr/>

      <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
        <TextField label={t("competition.winPoints")} value={winPoints} onChangeText={setWinPoints} keyboardType="number-pad" forceLtr containerStyle={{flex:1}}/>
        <TextField label={t("competition.drawPoints")} value={drawPoints} onChangeText={setDrawPoints} keyboardType="number-pad" forceLtr containerStyle={{flex:1}}/>
        <TextField label={t("competition.lossPoints")} value={lossPoints} onChangeText={setLossPoints} keyboardType="number-pad" forceLtr containerStyle={{flex:1}}/>
      </View>
      <AppText variant="caption" muted>{t("competition.control.tieBreakDefault")}</AppText>
    </Card>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    <Button label={t("competition.create")} onPress={()=>void submit()} loading={busy} disabled={!name.trim()}/>
    <Button label={t("owner.back")} onPress={()=>router.back()} variant="secondary"/>
  </Screen>;
}
