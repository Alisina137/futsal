import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import * as ImagePicker from "expo-image-picker";
import type {TeamDto,TeamDirectoryItemDto} from "@leaguekick/contracts";
import {router} from "expo-router";
import {useEffect,useState} from "react";
import {Image,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {ApiRequestError,marketingApi,resolveMediaImageUrl,teamApi,teamGrowthApi,
  type TeamGrowthData,type TeamGrowthPost} from "../../lib/api";
import {formatCompetitionDateTime} from "../../lib/date-time";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {DataLoadingState} from "../ui/DataLoadingState";
import {DateTimePickerField} from "../ui/DateTimePickerField";
import {TextField} from "../ui/TextField";

type Tab="media"|"statistics"|"matches";
function Counter({label,value}:{label:string;value:number|string}){
  return <View style={styles.stat}><AppText variant="title" weight="bold" style={{color:colors.primary}}>{value}</AppText>
    <AppText variant="caption" muted style={{textAlign:"center"}}>{label}</AppText></View>;
}
function Options({items,current,onChange}:{items:{id:string;name:string}[];current:string;onChange:(id:string)=>void}){
  return <ScrollView horizontal contentContainerStyle={{gap:spacing.sm,alignItems:"center"}} showsHorizontalScrollIndicator={false}>
    {items.map(item=><Pressable key={item.id} onPress={()=>onChange(item.id)}
      accessibilityRole="button" accessibilityState={{selected:current===item.id}}
      style={[styles.chip,item.id===current&&styles.active]}>
      <AppText variant="caption" weight="semibold" style={item.id===current?{color:colors.primary}:undefined}>{item.name}</AppText>
    </Pressable>)}
  </ScrollView>;
}

export function TeamGrowthPanel({tab,team,token,canWrite}:{tab:Tab;team:TeamDto;token:string;canWrite:boolean}){
  const {t,language}=useLocale();
  const tr=(key:string)=>t(`tm3.${key}` as never);
  const date=(x:string)=>formatCompetitionDateTime(x,language);
  const [data,setData]=useState<TeamGrowthData|null>(null);
  const [teams,setTeams]=useState<TeamDirectoryItemDto[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false),[uploading,setUploading]=useState(false);
  const [error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null);
  const [refresh,setRefresh]=useState(0);
  const [postBody,setPostBody]=useState("");
  const [imageUrl,setImageUrl]=useState<string|null>(null);
  const [postEditing,setPostEditing]=useState<string|null>(null);
  const [announcementTitle,setAnnouncementTitle]=useState("");
  const [announcementBody,setAnnouncementBody]=useState("");
  const [challengeTarget,setChallengeTarget]=useState("");
  const [challengeSearch,setChallengeSearch]=useState("");
  const [challengeTime,setChallengeTime]=useState("");
  const [challengeVenue,setChallengeVenue]=useState("");
  const [challengeMessage,setChallengeMessage]=useState("");
  const [showChallengeForm,setShowChallengeForm]=useState(false);
  const [mediaSection,setMediaSection]=useState<"POSTS"|"ANNOUNCEMENTS">("POSTS");
  const [statSection,setStatSection]=useState<"PERFORMANCE"|"PLAYERS"|"HISTORY">("PERFORMANCE");

  useEffect(()=>{
    let current=true;
    setLoading(true);setError(null);
    void teamGrowthApi.list(token,team.id)
      .then(value=>{if(current)setData(value);})
      .catch(err=>{if(current){setData(null);setError(err instanceof ApiRequestError?err.message:t("tm3.loadError"));}})
      .finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[token,team.id,refresh,t]);
  useEffect(()=>{
    if(tab!=="matches")return;
    let current=true;
    void teamApi.directory(token).then(v=>{if(current)setTeams(v.teams);}).catch(()=>{});
    return()=>{current=false;};
  },[tab,token]);

  async function execute(fn:()=>Promise<unknown>,after?:()=>void){
    if(busy)return;
    setBusy(true);setError(null);setMessage(null);
    try{await fn();after?.();setMessage(t("tm3.saved"));setRefresh(v=>v+1);}
    catch(e){setError(e instanceof ApiRequestError?e.message:t("tm3.actionFailed"));}
    finally{setBusy(false);}
  }
  async function selectPhoto(){
    if(!canWrite||uploading)return;
    try{
      const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],quality:0.8});
      if(result.canceled||!result.assets[0])return;
      setUploading(true);setError(null);
      const asset=result.assets[0];
      const image=await marketingApi.uploadUserPostImage(token,{
        uri:asset.uri,mimeType:asset.mimeType??"image/jpeg",size:asset.fileSize,
      });
      setImageUrl(image.imageUrl);
    }catch(e){setError(e instanceof ApiRequestError?e.message:t("tm3.uploadError"));}
    finally{setUploading(false);}
  }
  function editPost(post:TeamGrowthPost){
    setPostEditing(post.id);setPostBody(post.body);setImageUrl(post.imageUrl);setMediaSection("POSTS");
  }
  function resetPost(){setPostBody("");setImageUrl(null);setPostEditing(null);}
  const discovery=teams.filter(item=>item.id!==team.id&&item.status==="ACTIVE"&&
    (!challengeSearch||item.name.toLowerCase().includes(challengeSearch.toLowerCase())||
      item.city.toLowerCase().includes(challengeSearch.toLowerCase()))).slice(0,30);

  return <View style={{gap:spacing.md}}>
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText>
      <Button label={t("common.retry")} variant="secondary" onPress={()=>setRefresh(x=>x+1)}/></Card>:null}
    {message?<Card style={{backgroundColor:colors.primarySoft}}><AppText style={{color:colors.primary}}>{message}</AppText></Card>:null}
    {loading?<DataLoadingState variant="list" minHeight={300}/>:data?<>
      {tab==="media"?<>
        <Options items={[{id:"POSTS",name:tr("publicPosts")},{id:"ANNOUNCEMENTS",name:tr("privateAnnouncements")}]}
          current={mediaSection} onChange={id=>setMediaSection(id as typeof mediaSection)}/>
        {mediaSection==="POSTS"?<>
          <Card>
            <AppText variant="bodyLarge" weight="bold">{postEditing?tr("editPost"):tr("createPost")}</AppText>
            <AppText variant="caption" muted>{tr("postHelp")}</AppText>
            <TextField label={tr("postBody")} value={postBody} multiline onChangeText={setPostBody}/>
            {imageUrl?<Image source={{uri:resolveMediaImageUrl(imageUrl)??imageUrl}} resizeMode="cover" style={styles.mediaImage}/>:null}
            <View style={styles.actions}>
              <Button label={tr("addPhoto")} variant="secondary" loading={uploading} disabled={!canWrite}
                onPress={()=>void selectPhoto()}/>
              {imageUrl?<Button label={tr("removePhoto")} variant="ghost" onPress={()=>setImageUrl(null)}/>:null}
            </View>
            <Button label={postEditing?tr("savePost"):tr("publish")} loading={busy}
              disabled={!canWrite||uploading||(!postBody.trim()&&!imageUrl)}
              onPress={()=>void execute(async()=>{
                const input={body:postBody.trim(),imageUrl};
                if(postEditing)await teamGrowthApi.updatePost(token,team.id,postEditing,input);
                else await teamGrowthApi.createPost(token,team.id,input);
              },resetPost)}/>
            {postEditing?<Button variant="ghost" label={t("common.cancel")} onPress={resetPost}/>:null}
          </Card>
          <Card><AppText variant="bodyLarge" weight="bold">{tr("publishedPosts")}</AppText>
            {!data.posts.length?<AppText muted>{tr("noPosts")}</AppText>:null}
            {data.posts.map(post=><View style={styles.item} key={post.id}>
              <AppText variant="caption" muted>{date(post.publishedAt)}</AppText>
              {post.body?<AppText>{post.body}</AppText>:null}
              {post.imageUrl?<Image source={{uri:resolveMediaImageUrl(post.imageUrl)??post.imageUrl}} resizeMode="cover" style={styles.mediaImage}/>:null}
              <View style={styles.actions}>
                <Button label={tr("edit")} variant="secondary" disabled={!canWrite} onPress={()=>editPost(post)}/>
                <Button label={tr("delete")} variant="ghost" disabled={!canWrite||busy}
                  onPress={()=>void execute(()=>teamGrowthApi.deletePost(token,team.id,post.id))}/>
                <Button label={tr("viewInteractions")} variant="secondary"
                  onPress={()=>router.push({pathname:"/posts/[postId]/comments",params:{postId:post.id}})}/>
              </View>
            </View>)}
          </Card>
        </>:<>
          <Card><AppText variant="bodyLarge" weight="bold">{tr("newAnnouncement")}</AppText>
            <AppText variant="caption" muted>{tr("announcementHelp")}</AppText>
            <TextField label={tr("announcementTitle")} value={announcementTitle} onChangeText={setAnnouncementTitle}/>
            <TextField label={tr("announcementBody")} value={announcementBody} multiline onChangeText={setAnnouncementBody}/>
            <Button label={tr("sendAnnouncement")} disabled={!canWrite||busy||announcementTitle.trim().length<2||announcementBody.trim().length<2}
              loading={busy} onPress={()=>void execute(()=>teamGrowthApi.createAnnouncement(token,team.id,{
                title:announcementTitle.trim(),body:announcementBody.trim(),
              }),()=>{setAnnouncementTitle("");setAnnouncementBody("");})}/>
          </Card>
          <Card><AppText variant="bodyLarge" weight="bold">{tr("privateAnnouncements")}</AppText>
            <Button label={tr("memberView")} variant="secondary" onPress={()=>router.push({
              pathname:"/teams/[teamId]/announcements",params:{teamId:team.id},
            })}/>
            {!data.announcements.length?<AppText muted>{tr("noAnnouncements")}</AppText>:null}
            {data.announcements.map(a=><View key={a.id} style={styles.item}>
              <AppText weight="bold">{a.title}</AppText>
              <AppText variant="caption" muted>{date(a.createdAt)}</AppText>
              <AppText>{a.body}</AppText>
              <Button label={tr("delete")} variant="ghost" disabled={!canWrite||busy}
                onPress={()=>void execute(()=>teamGrowthApi.deleteAnnouncement(token,team.id,a.id))}/>
            </View>)}
          </Card>
        </>}
      </>:null}

      {tab==="statistics"?<>
        <Options current={statSection} onChange={id=>setStatSection(id as typeof statSection)}
          items={["PERFORMANCE","PLAYERS","HISTORY"].map(id=>({id,name:tr("stats."+id)}))}/>
        {statSection==="PERFORMANCE"?<>
          <View style={styles.stats}><Counter label={tr("played")} value={data.stats.played}/>
            <Counter label={tr("wins")} value={data.stats.wins}/>
            <Counter label={tr("draws")} value={data.stats.draws}/>
            <Counter label={tr("losses")} value={data.stats.losses}/>
            <Counter label={tr("goalsFor")} value={data.stats.goalsFor}/>
            <Counter label={tr("goalsAgainst")} value={data.stats.goalsAgainst}/>
            <Counter label={tr("goalDifference")} value={data.stats.goalDifference}/>
            <Counter label={tr("winRate")} value={data.stats.winRate+"%"}/></View>
          <Card><AppText weight="bold">{tr("titles")}: {data.stats.championships}</AppText>
            <AppText muted variant="caption">{tr("officialStatsHint")}</AppText>
          </Card>
        </>:null}
        {statSection==="PLAYERS"?<Card>
          <AppText variant="bodyLarge" weight="bold">{tr("playerLeaders")}</AppText>
          {!data.stats.players.length?<AppText muted>{tr("noPlayerStats")}</AppText>:null}
          {data.stats.players.map(p=><View key={p.userId} style={styles.item}>
            <AppText weight="semibold">{p.displayName}</AppText>
            <AppText variant="caption" muted>{tr("played")}: {p.matches} · {tr("goals")}: {p.goals} · {tr("assists")}: {p.assists}</AppText>
            <AppText variant="caption" muted>{tr("yellow")}: {p.yellowCards} · {tr("red")}: {p.redCards} · {tr("cleanSheets")}: {p.cleanSheets} · {tr("bestPlayer")}: {p.playerOfMatch}</AppText>
          </View>)}
        </Card>:null}
        {statSection==="HISTORY"?<Card>
          <AppText variant="bodyLarge" weight="bold">{tr("historyAndAwards")}</AppText>
          {!data.stats.competitionHistory.length?<AppText muted>{tr("noHistory")}</AppText>:null}
          {data.stats.competitionHistory.map(c=><View key={c.id} style={styles.item}>
            <AppText weight="bold">{c.name} {c.champion?"🏆":""}</AppText>
            <AppText variant="caption" muted>{c.format.replaceAll("_"," ")} · {c.status.replaceAll("_"," ")} · {c.registrationStatus.replaceAll("_"," ")}</AppText>
            {c.champion?<AppText weight="semibold" style={{color:colors.primary}}>{tr("confirmedTitle")}</AppText>:null}
            {c.rewards.length?<><AppText weight="semibold">{tr("offeredRewards")}</AppText>
              {c.rewards.map((reward,i)=><AppText key={i} variant="caption">{reward.title} · {reward.prize} ({reward.category})</AppText>)}
            </>:null}
            <Button label={tr("competitionDetails")} variant="secondary" onPress={()=>router.push({
              pathname:"/competitions/[competitionId]",params:{competitionId:c.id},
            })}/>
          </View>)}
          <AppText variant="caption" muted>{tr("rewardCaution")}</AppText>
        </Card>:null}
      </>:null}

      {tab==="matches"?<>
        <Card><AppText variant="bodyLarge" weight="bold">{tr("friendlyChallenges")}</AppText>
          <AppText variant="caption" muted>{tr("friendlyHelp")}</AppText>
          <Button label={tr("newChallenge")} disabled={!canWrite} onPress={()=>setShowChallengeForm(x=>!x)}/>
          {showChallengeForm?<View style={{gap:spacing.md}}>
            <TextField label={tr("findOpponent")} value={challengeSearch} onChangeText={setChallengeSearch}/>
            <Options items={discovery.map(c=>({id:c.id,name:c.name+" · "+c.city}))}
              current={challengeTarget} onChange={setChallengeTarget}/>
            {challengeTarget?<AppText variant="caption" muted>{tr("chosen")}: {teams.find(x=>x.id===challengeTarget)?.name}</AppText>:null}
            <DateTimePickerField label={tr("proposedTime")} value={challengeTime} minimumDate={new Date(Date.now()+30*60_000)}
              onChange={setChallengeTime}/>
            <TextField label={tr("venueName")} value={challengeVenue} onChangeText={setChallengeVenue}/>
            <TextField label={tr("challengeMessage")} value={challengeMessage} multiline onChangeText={setChallengeMessage}/>
            <Button label={tr("sendChallenge")} loading={busy} disabled={!canWrite||busy||!challengeTarget||
              !challengeTime||Date.parse(challengeTime)<Date.now()+30*60_000}
              onPress={()=>void execute(()=>teamGrowthApi.challenge(token,team.id,{
                toTeamId:challengeTarget,proposedAt:challengeTime,
                venueName:challengeVenue.trim()||null,message:challengeMessage.trim()||null,
              }),()=>{setChallengeTarget("");setChallengeTime("");setChallengeVenue("");setChallengeMessage("");setShowChallengeForm(false);})}/>
          </View>:null}
          {!data.challenges.length?<AppText muted>{tr("noChallenges")}</AppText>:null}
          {data.challenges.map(c=><View key={c.id} style={styles.item}>
            <AppText weight="semibold">{c.opponentName}</AppText>
            <AppText variant="caption" muted>{date(c.proposedAt)} · {tr("status."+c.status)}</AppText>
            {c.venueName?<AppText variant="caption">{c.venueName}</AppText>:null}
            {c.message?<AppText>{c.message}</AppText>:null}
            {c.toTeamId===team.id&&c.status==="PENDING"?<View style={styles.actions}>
              <Button label={tr("accept")} disabled={!canWrite||busy} loading={busy}
                onPress={()=>void execute(()=>teamGrowthApi.decideChallenge(token,team.id,c.id,"ACCEPTED"))}/>
              <Button label={tr("decline")} variant="secondary" disabled={!canWrite||busy}
                onPress={()=>void execute(()=>teamGrowthApi.decideChallenge(token,team.id,c.id,"DECLINED"))}/>
            </View>:null}
            {c.fromTeamId===team.id&&["PENDING","ACCEPTED"].includes(c.status)?
              <Button label={tr("cancelChallenge")} variant="ghost" disabled={!canWrite||busy}
                onPress={()=>void execute(()=>teamGrowthApi.cancelChallenge(token,team.id,c.id))}/>:null}
          </View>)}
        </Card>
      </>:null}
    </>:null}
  </View>;
}
const styles=StyleSheet.create({
  item:{borderTopWidth:1,borderColor:colors.border,paddingTop:spacing.md,marginTop:spacing.md,gap:spacing.sm},
  actions:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm,alignItems:"center"},
  mediaImage:{width:"100%",height:190,borderRadius:radius.md,backgroundColor:colors.primarySoft},
  chip:{backgroundColor:colors.surface,paddingHorizontal:spacing.md,paddingVertical:spacing.sm,
    borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,minHeight:40,justifyContent:"center"},
  active:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  stats:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},
  stat:{minWidth:70,flexBasis:"21%",flexGrow:1,backgroundColor:colors.surface,
    borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,padding:spacing.md,alignItems:"center",gap:spacing.xs},
});
