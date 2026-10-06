import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { TeamDto, TeamInvitationDto, TeamPrivacy } from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { teamApi } from "../../../../src/lib/api";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { DataLoadingState } from "../../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../../src/components/ui/Screen";
import { TextField } from "../../../../src/components/ui/TextField";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

export default function ManageTeamScreen(){
  const {teamId}=useLocalSearchParams<{teamId:string}>();
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const [team,setTeam]=useState<TeamDto|null>(null);
  const [invitations,setInvitations]=useState<TeamInvitationDto[]>([]);
  const [name,setName]=useState("");
  const [city,setCity]=useState("");
  const [logoUrl,setLogoUrl]=useState("");
  const [privacy,setPrivacy]=useState<TeamPrivacy>("PUBLIC");
  const [shirtDrafts,setShirtDrafts]=useState<Record<string,string>>({});
  const [transferTarget,setTransferTarget]=useState<string|null>(null);
  const [removeTarget,setRemoveTarget]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!session||!teamId)return;
    setLoading(true);setError(null);
    try{
      const [{team:nextTeam},{invitations:nextInvites}]=await Promise.all([
        teamApi.roster(session.accessToken,teamId),
        teamApi.teamInvitations(session.accessToken,teamId),
      ]);
      if(nextTeam.managerUserId!==session.user.id){
        router.replace({pathname:"/teams/[teamId]",params:{teamId}});
        return;
      }
      setTeam(nextTeam);
      setInvitations(nextInvites);
      setName(nextTeam.name);
      setCity(nextTeam.city);
      setLogoUrl(nextTeam.logoUrl??"");
      setPrivacy(nextTeam.privacy);
      setShirtDrafts(Object.fromEntries(nextTeam.members.map((member)=>[
        member.userId,
        member.shirtNumber===null?"":String(member.shirtNumber),
      ])));
    }catch{
      setError(t("teams.loadError"));
    }finally{setLoading(false);}
  },[session,t,teamId]);

  useEffect(()=>{void load();},[load]);

  async function saveTeam(){
    if(!session||!teamId)return;
    setBusy("team");setError(null);
    try{
      const {team:updated}=await teamApi.update(session.accessToken,teamId,{
        name:name.trim(),
        city:city.trim(),
        logoUrl,
        privacy,
      });
      setTeam(updated);
    }catch{setError(t("teams.saveError"));}
    finally{setBusy(null);}
  }

  async function saveShirt(userId:string){
    if(!session||!teamId)return;
    const raw=shirtDrafts[userId]?.trim()??"";
    const value=raw===""?null:Number(raw);
    if(value!==null&&(!Number.isInteger(value)||value<1||value>99)){
      setError(t("teams.shirtNumberInvalid"));
      return;
    }
    setBusy(`shirt:${userId}`);setError(null);
    try{
      const {team:updated}=await teamApi.updateMember(session.accessToken,teamId,userId,{shirtNumber:value});
      setTeam(updated);
    }catch{setError(t("teams.memberActionError"));}
    finally{setBusy(null);}
  }

  async function captain(userId:string|null){
    if(!session||!teamId)return;
    setBusy(`captain:${userId??"none"}`);setError(null);
    try{
      const {team:updated}=await teamApi.setCaptain(session.accessToken,teamId,userId);
      setTeam(updated);
    }catch{setError(t("teams.memberActionError"));}
    finally{setBusy(null);}
  }

  async function transfer(){
    if(!session||!teamId||!transferTarget)return;
    setBusy("transfer");setError(null);
    try{
      await teamApi.transferManager(session.accessToken,teamId,transferTarget);
      setTransferTarget(null);
      router.replace({pathname:"/teams/[teamId]",params:{teamId}});
    }catch{setError(t("teams.memberActionError"));}
    finally{setBusy(null);}
  }

  async function remove(){
    if(!session||!teamId||!removeTarget)return;
    setBusy("remove");setError(null);
    try{
      const {team:updated}=await teamApi.removeMember(session.accessToken,teamId,removeTarget);
      setTeam(updated);
      setRemoveTarget(null);
    }catch{setError(t("teams.memberActionError"));}
    finally{setBusy(null);}
  }

  async function revoke(invitationId:string){
    if(!session||!teamId)return;
    setBusy(`invite:${invitationId}`);setError(null);
    try{
      await teamApi.revokeInvitation(session.accessToken,teamId,invitationId);
      setInvitations((current)=>current.filter((item)=>item.id!==invitationId));
    }catch{setError(t("teams.revokeError"));}
    finally{setBusy(null);}
  }

  const pending=invitations.filter((item)=>item.status==="PENDING");

  if(loading)return <Screen showHeader><DataLoadingState variant="form" minHeight={500}/></Screen>;

  return <Screen showHeader>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("teams.manage")}</AppText>
      <AppText muted>{team?.name??""}</AppText>
    </View>
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}

    {team?<>
      <Card>
        <AppText variant="bodyLarge" weight="bold">{t("teams.teamSettings")}</AppText>
        <TextField label={t("teams.name")} value={name} onChangeText={setName}/>
        <TextField label={t("teams.city")} value={city} onChangeText={setCity}/>
        <TextField label={t("teams.logoUrl")} value={logoUrl} onChangeText={setLogoUrl} autoCapitalize="none" forceLtr placeholder="https://..."/>
        <AppText weight="semibold">{t("teams.privacy")}</AppText>
        <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
          {(["PUBLIC","PRIVATE"] as TeamPrivacy[]).map((value)=><Pressable
            key={value}
            onPress={()=>setPrivacy(value)}
            style={{
              flex:1,
              padding:spacing.md,
              borderRadius:radius.md,
              borderWidth:1,
              borderColor:privacy===value?colors.primary:colors.border,
              backgroundColor:privacy===value?colors.primarySoft:colors.surface,
            }}
          >
            <AppText weight="semibold" style={privacy===value?{color:colors.primary}:undefined}>
              {t(`teams.privacy.${value}` as never)}
            </AppText>
          </Pressable>)}
        </View>
        <Button label={t("teams.saveTeam")} onPress={()=>void saveTeam()} loading={busy==="team"} disabled={name.trim().length<2||city.trim().length<2}/>
      </Card>

      <Card>
        <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",justifyContent:"space-between",gap:spacing.sm}}>
          <View style={{flex:1}}>
            <AppText variant="bodyLarge" weight="bold">{t("teams.pendingInvitations")}</AppText>
            <AppText variant="caption" muted>{pending.length===0?t("teams.noPendingManagerInvitations"):t("teams.pendingCount",{count:pending.length})}</AppText>
          </View>
          <Button label={t("teams.invite")} onPress={()=>router.push({pathname:"/teams/[teamId]/invite",params:{teamId}})} variant="secondary"/>
        </View>
        {pending.map((invitation)=><View key={invitation.id} style={{gap:spacing.xs,paddingVertical:spacing.sm,borderTopWidth:1,borderTopColor:colors.border}}>
          <AppText weight="semibold">{invitation.invitedPublicDisplayName}</AppText>
          <AppText variant="caption" muted>{t(`teams.role.${invitation.role}` as never)}{invitation.shirtNumber?` · #${invitation.shirtNumber}`:""}</AppText>
          <Button
            label={t("teams.revokeInvitation")}
            onPress={()=>void revoke(invitation.id)}
            loading={busy===`invite:${invitation.id}`}
            variant="ghost"
          />
        </View>)}
      </Card>

      <View style={{gap:spacing.xs}}>
        <AppText variant="bodyLarge" weight="bold">{t("teams.roster")}</AppText>
        <AppText muted>{t("teams.members",{count:team.rosterCount})}</AppText>
      </View>

      {team.members.map((member)=><Card key={member.userId}>
        <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.md}}>
          {member.imageUrl?<Image source={{uri:member.imageUrl}} style={{width:52,height:52,borderRadius:26}}/>:
            <View style={{width:52,height:52,borderRadius:26,backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"}}>
              <AppText weight="bold" style={{color:colors.primary}}>{member.publicDisplayName.slice(0,2).toUpperCase()}</AppText>
            </View>}
          <View style={{flex:1}}>
            <AppText weight="bold">{member.publicDisplayName}</AppText>
            <AppText variant="caption" muted>{t(`teams.role.${member.role}` as never)} · {t(`teams.position.${member.position}` as never)}</AppText>
          </View>
        </View>

        <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"flex-end",gap:spacing.sm}}>
          <TextField
            label={t("teams.shirtNumber")}
            value={shirtDrafts[member.userId]??""}
            onChangeText={(value)=>setShirtDrafts((current)=>({...current,[member.userId]:value}))}
            keyboardType="number-pad"
            forceLtr
            containerStyle={{flex:1}}
          />
          <Button
            label={t("common.save")}
            onPress={()=>void saveShirt(member.userId)}
            loading={busy===`shirt:${member.userId}`}
            variant="secondary"
          />
        </View>

        {member.userId!==team.managerUserId?<View style={{gap:spacing.sm}}>
          <Button
            label={team.captainUserId===member.userId?t("teams.removeCaptain"):t("teams.setCaptain")}
            onPress={()=>void captain(team.captainUserId===member.userId?null:member.userId)}
            loading={busy===`captain:${member.userId}`||busy==="captain:none"}
            variant="secondary"
          />
          <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
            <Button
              label={t("teams.transferManager")}
              onPress={()=>setTransferTarget(member.userId)}
              variant="ghost"
              style={{flex:1}}
            />
            <Button
              label={t("teams.removeMember")}
              onPress={()=>setRemoveTarget(member.userId)}
              variant="ghost"
              style={{flex:1}}
            />
          </View>
        </View>:null}
      </Card>)}

      {transferTarget?<Card style={{borderColor:colors.warning}}>
        <AppText variant="bodyLarge" weight="bold">{t("teams.transferManager")}</AppText>
        <AppText>{t("teams.transferManagerWarning")}</AppText>
        <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
          <Button label={t("teams.confirmTransfer")} onPress={()=>void transfer()} loading={busy==="transfer"} style={{flex:1}}/>
          <Button label={t("teams.cancelAction")} onPress={()=>setTransferTarget(null)} variant="secondary" style={{flex:1}}/>
        </View>
      </Card>:null}

      {removeTarget?<Card style={{borderColor:colors.danger}}>
        <AppText variant="bodyLarge" weight="bold">{t("teams.removeMember")}</AppText>
        <AppText>{t("teams.removeMemberWarning")}</AppText>
        <View style={{flexDirection:isRTL?"row-reverse":"row",gap:spacing.sm}}>
          <Button label={t("teams.confirmRemove")} onPress={()=>void remove()} loading={busy==="remove"} variant="danger" style={{flex:1}}/>
          <Button label={t("teams.cancelAction")} onPress={()=>setRemoveTarget(null)} variant="secondary" style={{flex:1}}/>
        </View>
      </Card>:null}

      <Button label={t("common.retry")} onPress={()=>void load()} variant="secondary"/>
    </>:null}
  </Screen>;
}
