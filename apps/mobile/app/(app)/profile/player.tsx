import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { OwnPlayerProfileDto, PlayerPosition, ProfileVisibility } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { teamApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

const positions:PlayerPosition[]=["UNSPECIFIED","GOALKEEPER","FIXO","ALA","PIVO","UNIVERSAL"];

export default function EditPlayerProfileScreen(){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const [profile,setProfile]=useState<OwnPlayerProfileDto|null>(null);
  const [name,setName]=useState("");
  const [imageUrl,setImageUrl]=useState("");
  const [position,setPosition]=useState<PlayerPosition>("UNSPECIFIED");
  const [visibility,setVisibility]=useState<ProfileVisibility>("PUBLIC");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!session)return;
    setLoading(true);setError(null);
    try{
      const {player}=await teamApi.myProfile(session.accessToken);
      setProfile(player);
      setName(player.publicDisplayName);
      setImageUrl(player.imageUrl??"");
      setPosition(player.position);
      setVisibility(player.visibility);
    }catch{
      setError(t("teams.profileLoadError"));
    }finally{setLoading(false);}
  },[session,t]);

  useEffect(()=>{void load();},[load]);

  async function save(){
    if(!session||name.trim().length<2)return;
    setBusy(true);setError(null);
    try{
      const {player}=await teamApi.updateMyProfile(session.accessToken,{
        publicDisplayName:name.trim(),
        imageUrl,
        position,
        visibility,
      });
      setProfile(player);
      router.back();
    }catch{
      setError(t("teams.profileSaveError"));
    }finally{setBusy(false);}
  }

  return <Screen showHeader>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("teams.profileTitle")}</AppText>
      <AppText muted>{t("teams.profileSubtitle")}</AppText>
    </View>

    {loading?<DataLoadingState variant="form"/>:null}
    {profile?<Card style={{alignItems:"center",paddingVertical:spacing.lg}}>
      {imageUrl?<Image source={{uri:imageUrl}} style={{width:92,height:92,borderRadius:46}}/>:
        <View style={{width:92,height:92,borderRadius:46,backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"}}>
          <AppText variant="title" weight="bold" style={{color:colors.primary}}>{name.slice(0,2).toUpperCase()}</AppText>
        </View>}
      <AppText weight="semibold">{name}</AppText>
    </Card>:null}

    <TextField label={t("teams.publicDisplayName")} value={name} onChangeText={setName}/>
    <TextField label={t("teams.imageUrl")} value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" forceLtr placeholder="https://..."/>

    <Card>
      <AppText weight="semibold">{t("teams.position")}</AppText>
      <View style={{flexDirection:isRTL?"row-reverse":"row",flexWrap:"wrap",gap:spacing.sm}}>
        {positions.map((value)=><Pressable
          key={value}
          onPress={()=>setPosition(value)}
          style={{
            paddingHorizontal:spacing.md,
            paddingVertical:spacing.sm,
            borderRadius:radius.pill,
            borderWidth:1,
            borderColor:position===value?colors.primary:colors.border,
            backgroundColor:position===value?colors.primarySoft:colors.surface,
          }}
        >
          <AppText weight={position===value?"semibold":"regular"} style={position===value?{color:colors.primary}:undefined}>
            {t(`teams.position.${value}` as never)}
          </AppText>
        </Pressable>)}
      </View>
    </Card>

    <Card>
      <AppText weight="semibold">{t("teams.profileVisibility")}</AppText>
      {(["PUBLIC","PRIVATE"] as const).map((value)=><Pressable
        key={value}
        onPress={()=>setVisibility(value)}
        style={{
          padding:spacing.md,
          borderRadius:radius.md,
          borderWidth:1,
          borderColor:visibility===value?colors.primary:colors.border,
          backgroundColor:visibility===value?colors.primarySoft:colors.surface,
          gap:spacing.xs,
        }}
      >
        <AppText weight="semibold" style={visibility===value?{color:colors.primary}:undefined}>
          {t(`teams.profileVisibility.${value}` as never)}
        </AppText>
        <AppText variant="caption" muted>{t(value==="PUBLIC"?"teams.profilePublicBody":"teams.profilePrivateBody")}</AppText>
      </Pressable>)}
    </Card>

    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    <Button label={t("teams.saveProfile")} onPress={()=>void save()} loading={busy} disabled={name.trim().length<2}/>
    <Button label={t("owner.back")} onPress={()=>router.back()} variant="secondary"/>
  </Screen>;
}
