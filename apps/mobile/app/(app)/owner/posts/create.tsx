import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type {
  CompetitionDto,
  CompetitionListItemDto,
  PromotionDto,
  VenuePostDto,
  VenuePostScheduledAction,
  VenuePostType,
  VenuePostVisibility,
} from "@leaguekick/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { ApiRequestError, competitionApi, ownerApi } from "../../../../src/lib/api";
import { AppText } from "../../../../src/components/ui/AppText";
import { Button } from "../../../../src/components/ui/Button";
import { Card } from "../../../../src/components/ui/Card";
import { DataLoadingState } from "../../../../src/components/ui/DataLoadingState";
import { DateTimePickerField } from "../../../../src/components/ui/DateTimePickerField";
import { Screen } from "../../../../src/components/ui/Screen";
import { TextField } from "../../../../src/components/ui/TextField";
import { useAuth } from "../../../../src/providers/AuthProvider";
import { useLocale } from "../../../../src/providers/LocaleProvider";

type PublishMode="NOW"|"DRAFT"|"SCHEDULED";
type LocalSchedule={id:string;action:VenuePostScheduledAction;executeAt:string};

export default function CreatePostScreen(){
  const params=useLocalSearchParams<{postId?:string}>();
  const postId=typeof params.postId==="string"?params.postId:null;
  const editing=Boolean(postId);
  const {session}=useAuth();
  const {t,isRTL}=useLocale();

  const [body,setBody]=useState("");
  const [imageUrl,setImageUrl]=useState("");
  const [postType,setPostType]=useState<VenuePostType>("GENERAL");
  const [visibility,setVisibility]=useState<VenuePostVisibility>("PUBLIC");
  const [promotionId,setPromotionId]=useState<string|null>(null);
  const [competitionId,setCompetitionId]=useState<string|null>(null);
  const [promotions,setPromotions]=useState<PromotionDto[]>([]);
  const [competitions,setCompetitions]=useState<CompetitionListItemDto[]>([]);
  const [competitionDetail,setCompetitionDetail]=useState<CompetitionDto|null>(null);
  const [notifyFollowers,setNotifyFollowers]=useState(false);
  const [publishMode,setPublishMode]=useState<PublishMode>("NOW");
  const [publishAt,setPublishAt]=useState("");
  const [localSchedules,setLocalSchedules]=useState<LocalSchedule[]>([]);
  const [scheduleAction,setScheduleAction]=useState<VenuePostScheduledAction>("MAKE_PRIVATE");
  const [scheduleAt,setScheduleAt]=useState("");
  const [existing,setExisting]=useState<VenuePostDto|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [scheduleBusy,setScheduleBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    if(!session){setLoading(false);return;}
    let active=true;
    void (async()=>{
      try{
        const [promotionResult,competitionResult,postResult]=await Promise.all([
          ownerApi.promotions(session.accessToken),
          competitionApi.ownerList(session.accessToken),
          postId?ownerApi.posts(session.accessToken):Promise.resolve(null),
        ]);
        if(!active)return;
        setPromotions(promotionResult.promotions.filter((item)=>item.status==="ACTIVE"));
        setCompetitions(competitionResult.competitions);
        if(postId&&postResult){
          const post=postResult.posts.find((item)=>item.id===postId)??null;
          if(!post){setError(t("media.postNotFound"));return;}
          setExisting(post);
          setBody(post.body);
          setImageUrl(post.imageUrl??"");
          setPostType(post.postType);
          setVisibility(post.visibility);
          setNotifyFollowers(post.notifyFollowers);
          if(post.ctaType==="PROMOTION")setPromotionId(post.ctaTargetId);
          if(post.ctaType==="COMPETITION")setCompetitionId(post.ctaTargetId);
        }
      }catch{
        if(active)setError(t("media.composerLoadError"));
      }finally{
        if(active)setLoading(false);
      }
    })();
    return()=>{active=false;};
  },[postId,session,t]);

  useEffect(()=>{
    if(!session||!competitionId||postType!=="RESULT"){setCompetitionDetail(null);return;}
    competitionApi.ownerGet(session.accessToken,competitionId)
      .then((result)=>setCompetitionDetail(result.competition))
      .catch(()=>setCompetitionDetail(null));
  },[competitionId,postType,session]);

  const completedMatches=useMemo(
    ()=>competitionDetail?.matches.filter((match)=>match.status==="COMPLETED"||match.status==="CORRECTED").slice().reverse()??[],
    [competitionDetail],
  );

  function chooseType(value:VenuePostType){
    setPostType(value);
    if(value==="PROMOTION"){
      setCompetitionId(null);
    }else if(value==="COMPETITION"||value==="RESULT"){
      setPromotionId(null);
    }else{
      setPromotionId(null);
      setCompetitionId(null);
    }
  }

  function addLocalSchedule(){
    if(!scheduleAt){setError(t("media.scheduleTimeRequired"));return;}
    if(new Date(scheduleAt).getTime()<=Date.now()){setError(t("media.schedulePast"));return;}
    const next:LocalSchedule={id:`${Date.now()}-${localSchedules.length}`,action:scheduleAction,executeAt:scheduleAt};
    setLocalSchedules((current)=>[...current,next].sort((a,b)=>a.executeAt.localeCompare(b.executeAt)));
    setScheduleAt("");
    setError(null);
  }

  async function addExistingSchedule(){
    if(!session||!postId||!scheduleAt)return;
    if(new Date(scheduleAt).getTime()<=Date.now()){setError(t("media.schedulePast"));return;}
    setScheduleBusy(true);setError(null);
    try{
      await ownerApi.addPostSchedule(session.accessToken,postId,{action:scheduleAction,executeAt:scheduleAt});
      const refreshed=(await ownerApi.posts(session.accessToken)).posts.find((item)=>item.id===postId)??null;
      setExisting(refreshed);
      setScheduleAt("");
    }catch(cause){
      setError(cause instanceof ApiRequestError&&cause.code==="MEDIA_SCHEDULE_IN_PAST"?t("media.schedulePast"):t("media.scheduleError"));
    }finally{setScheduleBusy(false);}
  }

  async function cancelExistingSchedule(scheduleId:string){
    if(!session||!postId)return;
    setScheduleBusy(true);setError(null);
    try{
      await ownerApi.cancelPostSchedule(session.accessToken,postId,scheduleId);
      const refreshed=(await ownerApi.posts(session.accessToken)).posts.find((item)=>item.id===postId)??null;
      setExisting(refreshed);
    }catch{setError(t("media.scheduleCancelError"));}
    finally{setScheduleBusy(false);}
  }

  function cta(){
    if(postType==="PROMOTION")return {ctaType:"PROMOTION" as const,ctaTargetId:promotionId};
    if(postType==="COMPETITION"||postType==="RESULT")return {ctaType:"COMPETITION" as const,ctaTargetId:competitionId};
    return {ctaType:"NONE" as const,ctaTargetId:null};
  }

  async function submit(){
    if(!session||!body.trim())return;
    if(postType==="PROMOTION"&&!promotionId){setError(t("media.choosePromotionError"));return;}
    if((postType==="COMPETITION"||postType==="RESULT")&&!competitionId){setError(t("media.chooseCompetitionError"));return;}
    if(!editing&&publishMode==="SCHEDULED"&&!publishAt){setError(t("media.publishTimeRequired"));return;}

    setBusy(true);setError(null);
    try{
      const target=cta();
      if(postId){
        await ownerApi.updatePost(session.accessToken,postId,{
          body:body.trim(),
          imageUrl,
          postType,
          visibility,
          notifyFollowers,
          ...target,
        });
      }else{
        await ownerApi.createPost(session.accessToken,{
          body:body.trim(),
          imageUrl,
          postType,
          visibility,
          notifyFollowers,
          publishMode,
          publishAt:publishMode==="SCHEDULED"?publishAt:null,
          schedules:localSchedules.map(({action,executeAt})=>({action,executeAt})),
          ...target,
        });
      }
      router.replace("/owner/posts");
    }catch(cause){
      if(cause instanceof ApiRequestError&&cause.code==="INVALID_POST_CTA")setError(t("media.invalidCta"));
      else if(cause instanceof ApiRequestError&&cause.code==="MEDIA_SCHEDULE_IN_PAST")setError(t("media.schedulePast"));
      else if(cause instanceof ApiRequestError&&cause.code==="SUBSCRIPTION_REQUIRED")setError(t("ownerMarketing.entitlementRequired"));
      else setError(t("media.saveError"));
    }finally{setBusy(false);}
  }

  function useResult(match:CompetitionDto["matches"][number]){
    if(match.homeTeamName===null||match.awayTeamName===null||match.homeScore===null||match.awayScore===null||!competitionDetail)return;
    setBody(t("media.resultTemplate",{
      competition:competitionDetail.name,
      home:match.homeTeamName,
      homeScore:match.homeScore,
      awayScore:match.awayScore,
      away:match.awayTeamName,
    }));
  }

  if(loading)return <Screen embedded><DataLoadingState variant="form" minHeight={560}/></Screen>;

  const canSubmit=body.trim().length>0
    &&(postType!=="PROMOTION"||promotionId!==null)
    &&((postType!=="COMPETITION"&&postType!=="RESULT")||competitionId!==null)
    &&(editing||publishMode!=="SCHEDULED"||Boolean(publishAt))
    &&!busy;

  return <Screen embedded>
    <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <Pressable onPress={()=>router.back()} style={styles.backButton}>
        <Ionicons name={isRTL?"chevron-forward":"chevron-back"} size={21} color={colors.primary}/>
      </Pressable>
      <View style={{flex:1,gap:2}}>
        <AppText variant="title" weight="bold">{editing?t("media.editPost"):t("media.createPost")}</AppText>
        <AppText muted>{t("media.composerSubtitle")}</AppText>
      </View>
    </View>

    {error?<Card style={styles.errorCard}><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}

    <Card style={styles.card}>
      <AppText weight="bold">{t("media.postType")}</AppText>
      <View style={[styles.chips,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {(["GENERAL","ANNOUNCEMENT","PROMOTION","COMPETITION","RESULT"] as const).map((value)=><Choice
          key={value}
          selected={postType===value}
          label={t(`media.type.${value}` as never)}
          onPress={()=>chooseType(value)}
        />)}
      </View>

      <TextField label={t("media.postBody")} value={body} onChangeText={setBody} multiline maxLength={2000}/>
      <TextField label={t("media.imageUrl")} value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" forceLtr hint="https://..."/>
    </Card>

    {postType==="PROMOTION"?<Card style={styles.card}>
      <AppText weight="bold">{t("media.choosePromotion")}</AppText>
      {!promotions.length?<AppText muted>{t("media.noPromotions")}</AppText>:null}
      {promotions.map((item)=><Pressable key={item.id} onPress={()=>setPromotionId(item.id)}>
        <View style={[styles.selectCard,promotionId===item.id&&styles.selectCardActive]}>
          <AppText weight="bold">{item.title}</AppText>
          <AppText>{item.discountedPriceAfn} AFN · {item.areaName}</AppText>
          <AppText variant="caption" muted forceLtr>{item.startsAt}</AppText>
        </View>
      </Pressable>)}
    </Card>:null}

    {postType==="COMPETITION"||postType==="RESULT"?<Card style={styles.card}>
      <AppText weight="bold">{t("media.chooseCompetition")}</AppText>
      {!competitions.length?<AppText muted>{t("media.noCompetitions")}</AppText>:null}
      {competitions.map((item)=><Pressable key={item.id} onPress={()=>setCompetitionId(item.id)}>
        <View style={[styles.selectCard,competitionId===item.id&&styles.selectCardActive]}>
          <AppText weight="bold">{item.name}</AppText>
          <AppText variant="caption" muted>{t(`competition.status.${item.status}` as never)}</AppText>
        </View>
      </Pressable>)}
    </Card>:null}

    {postType==="RESULT"&&competitionId?<Card style={styles.card}>
      <AppText weight="bold">{t("media.recentResults")}</AppText>
      {!completedMatches.length?<AppText muted>{t("media.noResults")}</AppText>:null}
      {completedMatches.slice(0,8).map((match)=><View key={match.id} style={[styles.resultRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={{flex:1,gap:2}}>
          <AppText weight="semibold">
            {match.homeTeamName??"—"} {match.homeScore??"—"} - {match.awayScore??"—"} {match.awayTeamName??"—"}
          </AppText>
          <AppText variant="caption" muted>{match.groupName??match.stage}</AppText>
        </View>
        <Button label={t("media.useResult")} onPress={()=>useResult(match)} variant="secondary"/>
      </View>)}
    </Card>:null}

    <Card style={styles.card}>
      <AppText weight="bold">{t("media.audience")}</AppText>
      <View style={[styles.chips,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {(["PUBLIC","FOLLOWERS","PRIVATE"] as const).map((value)=><Choice
          key={value}
          selected={visibility===value}
          label={t(`media.visibility.${value}` as never)}
          onPress={()=>setVisibility(value)}
        />)}
      </View>
      <View style={[styles.switchRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={{flex:1}}>
          <AppText weight="semibold">{t("media.notifyFollowers")}</AppText>
          <AppText variant="caption" muted>{t("media.notifyFollowersHint")}</AppText>
        </View>
        <Switch value={notifyFollowers} onValueChange={setNotifyFollowers}/>
      </View>
    </Card>

    {!editing?<Card style={styles.card}>
      <AppText weight="bold">{t("media.publishMode")}</AppText>
      <View style={[styles.chips,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {(["NOW","DRAFT","SCHEDULED"] as const).map((value)=><Choice
          key={value}
          selected={publishMode===value}
          label={t(`media.publishMode.${value}` as never)}
          onPress={()=>setPublishMode(value)}
        />)}
      </View>
      {publishMode==="SCHEDULED"?<DateTimePickerField
        label={t("media.publishAt")}
        value={publishAt}
        onChange={setPublishAt}
        minimumDate={new Date(Date.now()+60_000)}
      />:null}
    </Card>:null}

    <Card style={styles.card}>
      <AppText weight="bold">{t("media.automation")}</AppText>
      <AppText variant="caption" muted>{t("media.automationHint")}</AppText>
      <View style={[styles.chips,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {(["PUBLISH","UNPUBLISH","MAKE_PUBLIC","MAKE_FOLLOWERS","MAKE_PRIVATE","DELETE"] as const).map((value)=><Choice
          key={value}
          selected={scheduleAction===value}
          label={t(`media.action.${value}` as never)}
          onPress={()=>setScheduleAction(value)}
        />)}
      </View>
      <DateTimePickerField
        label={t("media.actionAt")}
        value={scheduleAt}
        onChange={setScheduleAt}
        minimumDate={new Date(Date.now()+60_000)}
      />
      <Button
        label={t("media.addAutomation")}
        onPress={editing?()=>void addExistingSchedule():addLocalSchedule}
        loading={scheduleBusy}
        disabled={!scheduleAt}
        variant="secondary"
      />

      {!editing&&localSchedules.map((item)=><View key={item.id} style={[styles.scheduleRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <AppText style={{flex:1}}>{t(`media.action.${item.action}` as never)}</AppText>
        <AppText variant="caption" muted forceLtr>{item.executeAt}</AppText>
        <Pressable onPress={()=>setLocalSchedules((current)=>current.filter((value)=>value.id!==item.id))}>
          <Ionicons name="close-circle" size={21} color={colors.danger}/>
        </Pressable>
      </View>)}

      {editing?existing?.schedules.filter((item)=>!item.executedAt&&!item.cancelledAt).map((item)=><View key={item.id} style={[styles.scheduleRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <AppText style={{flex:1}}>{t(`media.action.${item.action}` as never)}</AppText>
        <AppText variant="caption" muted forceLtr>{item.executeAt}</AppText>
        <Pressable disabled={scheduleBusy} onPress={()=>void cancelExistingSchedule(item.id)}>
          <Ionicons name="close-circle" size={21} color={colors.danger}/>
        </Pressable>
      </View>):null}
    </Card>

    <Button label={editing?t("media.saveChanges"):t("media.createPost")} onPress={()=>void submit()} loading={busy} disabled={!canSubmit}/>
    <Button label={t("owner.back")} onPress={()=>router.back()} variant="secondary"/>
  </Screen>;
}

function Choice({selected,label,onPress}:{selected:boolean;label:string;onPress:()=>void}){
  return <Pressable
    onPress={onPress}
    style={[styles.choice,selected&&styles.choiceActive]}
  >
    <AppText variant="caption" weight={selected?"bold":"semibold"} style={selected?{color:colors.primary}:undefined}>{label}</AppText>
  </Pressable>;
}

const styles=StyleSheet.create({
  heading:{alignItems:"center",gap:spacing.sm},
  backButton:{width:44,height:44,borderRadius:radius.md,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  errorCard:{borderColor:colors.danger},
  card:{gap:spacing.md},
  chips:{gap:spacing.xs,flexWrap:"wrap"},
  choice:{minHeight:38,paddingHorizontal:spacing.sm,paddingVertical:spacing.xs,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,alignItems:"center",justifyContent:"center"},
  choiceActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  selectCard:{padding:spacing.sm,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,gap:3},
  selectCardActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  resultRow:{alignItems:"center",gap:spacing.sm,paddingVertical:spacing.sm,borderBottomWidth:1,borderBottomColor:colors.border},
  switchRow:{alignItems:"center",gap:spacing.md},
  scheduleRow:{alignItems:"center",gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
});
