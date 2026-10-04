import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { CompetitionCreateRequest, CompetitionFormat } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { competitionApi } from "../../../../src/lib/api";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { Screen } from "../../../../src/components/ui/Screen";
import { TextField } from "../../../../src/components/ui/TextField";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

const formats:CompetitionFormat[]=["LEAGUE","KNOCKOUT","GROUP_KNOCKOUT"];

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
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  async function submit(){
    if(!session)return;
    const max=Number(maxTeams);
    const registrationFeeAfn=Number(fee);
    const groups=Number(groupCount);
    const qualified=Number(qualifiers);
    if(!name.trim()||!Number.isInteger(max)||max<2||!Number.isInteger(registrationFeeAfn)||registrationFeeAfn<0){
      setError(t("competition.createError"));return;
    }
    const input:CompetitionCreateRequest={
      name:name.trim(),
      description:description.trim(),
      format,
      maxTeams:max,
      registrationFeeAfn,
      winPoints:3,
      drawPoints:1,
      lossPoints:0,
      tieBreakOrder:["POINTS","GOAL_DIFFERENCE","GOALS_FOR","HEAD_TO_HEAD","ADMIN"],
      groupCount:format==="GROUP_KNOCKOUT"?groups:null,
      qualifiersPerGroup:format==="GROUP_KNOCKOUT"?qualified:null,
      startsAt:null,
      endsAt:null,
    };
    setBusy(true);setError(null);
    try{
      const {competition}=await competitionApi.create(session.accessToken,input);
      router.replace({pathname:"/owner/competitions/[competitionId]/manage",params:{competitionId:competition.id}});
    }catch{setError(t("competition.createError"));}
    finally{setBusy(false);}
  }

  return <Screen showHeader>
    <AppText variant="title" weight="bold">{t("competition.createTitle")}</AppText>
    <TextField label={t("competition.name")} value={name} onChangeText={setName}/>
    <TextField label={t("competition.description")} value={description} onChangeText={setDescription} multiline/>

    <Card>
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
          <AppText weight="semibold" style={format===value?{color:colors.primary}:undefined}>{t(`competition.format.${value}` as never)}</AppText>
        </Pressable>)}
      </View>
    </Card>

    <TextField label={t("competition.maxTeams")} value={maxTeams} onChangeText={setMaxTeams} keyboardType="number-pad" forceLtr/>
    <TextField label={t("competition.registrationFee")} value={fee} onChangeText={setFee} keyboardType="number-pad" forceLtr/>
    {format==="GROUP_KNOCKOUT"?<>
      <TextField label={t("competition.groupCount")} value={groupCount} onChangeText={setGroupCount} keyboardType="number-pad" forceLtr/>
      <TextField label={t("competition.qualifiersPerGroup")} value={qualifiers} onChangeText={setQualifiers} keyboardType="number-pad" forceLtr/>
    </>:null}

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    <Button label={t("competition.create")} onPress={()=>void submit()} loading={busy} disabled={!name.trim()}/>
    <Button label={t("owner.back")} onPress={()=>router.back()} variant="secondary"/>
  </Screen>;
}
