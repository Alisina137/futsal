import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { SocialFollowStateDto, TeamDto, TeamJoinRequestStatus } from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { marketingApi, teamApi, teamManagerApi, type TeamManagerProfileDetails } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

export default function TeamDetailScreen(){
  const {teamId}=useLocalSearchParams<{teamId:string}>();
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const [team,setTeam]=useState<TeamDto|null>(null);
  const [profileDetails,setProfileDetails]=useState<Omit<TeamManagerProfileDetails,"allowJoinRequests">|null>(null);
  const [member,setMember]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [followState,setFollowState]=useState<SocialFollowStateDto|null>(null);
  const [followBusy,setFollowBusy]=useState(false);
  const [joinRequestStatus,setJoinRequestStatus]=useState<TeamJoinRequestStatus|null>(null);
  const [joinBusy,setJoinBusy]=useState(false);

  const load=useCallback(async()=>{
    if(!teamId)return;
    setLoading(true);setError(null);
    try{
      let next=(await teamApi.publicTeam(teamId)).team;
      if(session){
        try{
          const mine=(await teamApi.mine(session.accessToken)).teams.some((item)=>item.id===teamId);
          setMember(mine);
          if(mine){
            setJoinRequestStatus(null);
            next=(await teamApi.roster(session.accessToken,teamId)).team;
          }else{
            setJoinRequestStatus((await teamApi.joinRequest(session.accessToken,teamId)).request?.status??null);
          }
        }catch{}
      }
      setTeam(next);
      void teamManagerApi.publicDetails(teamId).then(v=>setProfileDetails(v.profile)).catch(()=>setProfileDetails(null));
    }catch{
      setError(t("teams.publicTeamLoadError"));
    }finally{setLoading(false);}
  },[session,t,teamId]);

  useEffect(()=>{void load();},[load]);

  useEffect(()=>{
    if(!session||!teamId)return;
    marketingApi.socialFollowState(session.accessToken,"TEAM",teamId).then(setFollowState).catch(()=>{});
  },[session,teamId]);

  async function toggleFollow(){
    if(!session||!teamId||!followState)return;
    setFollowBusy(true);setError(null);
    try{
      setFollowState(followState.following
        ?await marketingApi.socialUnfollow(session.accessToken,"TEAM",teamId)
        :await marketingApi.socialFollow(session.accessToken,"TEAM",teamId));
    }catch{
      setError(t("social.followError"));
    }finally{setFollowBusy(false);}
  }

  async function requestJoin(){
    if(!session||!teamId||member||joinRequestStatus==="PENDING")return;
    setJoinBusy(true);setError(null);
    try{
      const result=await teamApi.requestJoin(session.accessToken,teamId);
      setJoinRequestStatus(result.request.status);
    }catch{
      setError(t("teams.joinRequestError"));
    }finally{setJoinBusy(false);}
  }

  const myRole=team&&session
    ?team.managerUserId===session.user.id
      ?"MANAGER"
      :team.captainUserId===session.user.id
        ?"CAPTAIN"
        :member?"PLAYER":null
    :null;

  if(loading)return <Screen showHeader><DataLoadingState variant="detail" minHeight={500}/></Screen>;

  return <Screen showHeader>
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}

    {team?<>
      <View style={styles.hero}>
        {team.logoUrl
          ?<Image source={{uri:team.logoUrl}} style={styles.logo}/>
          :<View style={styles.logoFallback}>
            <AppText variant="title" weight="bold" style={{color:colors.primary}}>{team.name.slice(0,2).toUpperCase()}</AppText>
          </View>}
        <View style={styles.typeBadge}>
          <AppText variant="caption" weight="bold" style={{color:"#FFFFFF"}}>{t("social.entity.TEAM")}</AppText>
        </View>
        <AppText variant="title" weight="bold" style={styles.heroTitle}>{team.name}</AppText>
        <View style={[styles.inline,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="location-outline" size={16} color="#DCE8FF"/>
          <AppText style={styles.heroMuted}>{team.city}</AppText>
        </View>
        {myRole?<View style={styles.roleBadge}>
          <AppText variant="caption" weight="bold" style={{color:colors.primary}}>
            {t("teams.myRole")}: {t(`teams.role.${myRole}` as never)}
          </AppText>
        </View>:null}
      </View>

      {profileDetails&&(profileDetails.description||profileDetails.province||profileDetails.district||profileDetails.foundedOn||profileDetails.contactPhone)?
        <Card>
          <AppText variant="bodyLarge" weight="bold">{t("tm1.teamIdentity")}</AppText>
          {profileDetails.description?<AppText>{profileDetails.description}</AppText>:null}
          {profileDetails.province?<AppText variant="caption" muted>{t("tm1.province")}: {profileDetails.province}</AppText>:null}
          {profileDetails.district?<AppText variant="caption" muted>{t("tm1.district")}: {profileDetails.district}</AppText>:null}
          {profileDetails.foundedOn?<AppText variant="caption" muted>{t("tm1.foundedOn")}: {profileDetails.foundedOn}</AppText>:null}
          {profileDetails.contactPhone?<AppText variant="caption" muted>{t("tm1.contactPhone")}: {profileDetails.contactPhone}</AppText>:null}
        </Card>:null}
      {myRole?<Card>
        <Button label={t("tm2.memberSchedule")} variant="secondary"
          onPress={()=>router.push({pathname:"/teams/[teamId]/activities",params:{teamId:team.id}})}/>
        <Button label={t("tm3.privateAnnouncements")} variant="secondary"
          onPress={()=>router.push({pathname:"/teams/[teamId]/announcements",params:{teamId:team.id}})}/>
      </Card>:null}

      <View style={styles.statGrid}>
        <ProfileStat
          icon="people-outline"
          value={String(team.rosterCount)}
          label={t("publicProfile.members")}
        />
        <ProfileStat
          icon={team.privacy==="PUBLIC"?"globe-outline":"lock-closed-outline"}
          value={t(`teams.privacy.${team.privacy}` as never)}
          label={t("publicProfile.privacy")}
        />
        <ProfileStat
          icon="heart-outline"
          value={String(followState?.followerCount??0)}
          label={t("publicProfile.followers")}
        />
      </View>

      <View style={[styles.actionRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {followState?<Button
          label={followState.following?t("social.unfollow"):t("social.follow")}
          onPress={()=>void toggleFollow()}
          loading={followBusy}
          variant={followState.following?"secondary":"primary"}
          style={{flex:1}}
        />:null}

        {!member&&myRole!=="MANAGER"?<Button
          label={joinRequestStatus==="PENDING"?t("teams.joinRequestPending"):t("teams.requestToJoin")}
          onPress={()=>void requestJoin()}
          loading={joinBusy}
          disabled={joinRequestStatus==="PENDING"}
          variant={joinRequestStatus==="PENDING"?"secondary":"primary"}
          style={{flex:1}}
        />:null}

        {myRole==="MANAGER"?<Button
          label={t("teams.manage")}
          onPress={()=>router.push({pathname:"/teams/[teamId]/manage",params:{teamId}})}
          style={{flex:1}}
        />:null}
      </View>

      {joinRequestStatus==="PENDING"&&!member?<Card style={{backgroundColor:colors.surfaceMuted}}>
        <View style={[styles.inline,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="time-outline" size={18} color={colors.warning}/>
          <AppText weight="semibold" style={{color:colors.warning}}>{t("teams.joinRequestPending")}</AppText>
        </View>
        <AppText muted>{t("teams.joinRequestPendingBody")}</AppText>
      </Card>:null}

      <View style={{gap:spacing.xs}}>
        <AppText variant="bodyLarge" weight="bold">{t("teams.roster")}</AppText>
        <AppText muted>{team.privacy==="PRIVATE"&&!member?t("teams.privateRoster"):t("teams.members",{count:team.rosterCount})}</AppText>
      </View>

      {team.members.map((player)=><Pressable
        key={player.userId}
        accessibilityRole="button"
        onPress={()=>router.push({pathname:"/players/[playerId]",params:{playerId:player.userId}})}
        style={({pressed})=>pressed?{opacity:0.76}:undefined}
      >
        <Card style={styles.memberCard}>
          <View style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",gap:spacing.md}}>
            {player.imageUrl
              ?<Image source={{uri:player.imageUrl}} style={styles.memberAvatar}/>
              :<View style={styles.memberFallback}>
                <AppText weight="bold" style={{color:colors.primary}}>{player.publicDisplayName.slice(0,2).toUpperCase()}</AppText>
              </View>}
            <View style={{flex:1,gap:3,alignItems:isRTL?"flex-end":"flex-start"}}>
              <AppText weight="bold">{player.publicDisplayName}</AppText>
              <View style={[styles.inline,{flexDirection:isRTL?"row-reverse":"row",flexWrap:"wrap"}]}>
                <View style={styles.smallBadge}>
                  <AppText variant="caption" weight="semibold">{t(`teams.role.${player.role}` as never)}</AppText>
                </View>
                <AppText variant="caption" muted>{t(`teams.position.${player.position}` as never)}</AppText>
              </View>
              {player.shirtNumber?<AppText variant="caption" style={{color:colors.primary}}>{t("teams.shirtNumberValue",{number:player.shirtNumber})}</AppText>:null}
            </View>
            <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={18} color={colors.textMuted}/>
          </View>
        </Card>
      </Pressable>)}

      {!loading&&team.members.length===0&&team.privacy==="PRIVATE"&&!member?<Card>
        <View style={{alignItems:"center",gap:spacing.sm}}>
          <Ionicons name="lock-closed-outline" size={26} color={colors.textMuted}/>
          <AppText muted style={{textAlign:"center"}}>{t("teams.privateRoster")}</AppText>
        </View>
      </Card>:null}

      <Button label={t("common.retry")} onPress={()=>void load()} variant="ghost"/>
    </>:null}
  </Screen>;
}

function ProfileStat({icon,value,label}:{icon:keyof typeof Ionicons.glyphMap;value:string;label:string}){
  return <Card style={styles.statCard}>
    <View style={styles.statIcon}><Ionicons name={icon} size={19} color={colors.primary}/></View>
    <AppText weight="bold" style={{textAlign:"center"}}>{value}</AppText>
    <AppText variant="caption" muted style={{textAlign:"center"}}>{label}</AppText>
  </Card>;
}

const styles=StyleSheet.create({
  hero:{
    borderRadius:radius.lg,
    padding:spacing.lg,
    backgroundColor:colors.primary,
    alignItems:"center",
    gap:spacing.sm,
  },
  logo:{width:88,height:88,borderRadius:44,borderWidth:4,borderColor:"#DCE8FF"},
  logoFallback:{width:88,height:88,borderRadius:44,backgroundColor:"#FFFFFF",borderWidth:4,borderColor:"#DCE8FF",alignItems:"center",justifyContent:"center"},
  typeBadge:{paddingHorizontal:spacing.sm,paddingVertical:4,borderRadius:radius.pill,backgroundColor:"rgba(255,255,255,0.16)"},
  heroTitle:{color:"#FFFFFF",textAlign:"center"},
  heroMuted:{color:"#DCE8FF"},
  roleBadge:{paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,borderRadius:radius.pill,backgroundColor:"#FFFFFF"},
  inline:{alignItems:"center",gap:5},
  statGrid:{flexDirection:"row",gap:spacing.xs},
  statCard:{flex:1,minWidth:0,alignItems:"center",gap:spacing.xs,paddingHorizontal:spacing.xs,paddingVertical:spacing.md},
  statIcon:{width:34,height:34,borderRadius:17,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  actionRow:{gap:spacing.sm},
  memberCard:{padding:spacing.md},
  memberAvatar:{width:52,height:52,borderRadius:26},
  memberFallback:{width:52,height:52,borderRadius:26,backgroundColor:colors.primarySoft,alignItems:"center",justifyContent:"center"},
  smallBadge:{paddingHorizontal:spacing.sm,paddingVertical:3,borderRadius:radius.pill,backgroundColor:colors.surfaceMuted},
});
