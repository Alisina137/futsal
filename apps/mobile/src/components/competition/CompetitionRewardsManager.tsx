import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {CompetitionDto,CompetitionRewardDto} from "@leaguekick/contracts";
import {useState} from "react";
import {Pressable,StyleSheet,View} from "react-native";
import {competitionApi} from "../../lib/api";
import {useLocale} from "../../providers/LocaleProvider";
import {AppText} from "../ui/AppText";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {TextField} from "../ui/TextField";

type Category=CompetitionRewardDto["category"];
const categories:Category[]=["TEAM","INDIVIDUAL"];

/** Staged draft editor; nothing reaches public About until the owner taps Save. */
export function CompetitionRewardsManager({competition,token,onSaved}:{
  competition:CompetitionDto;token:string;onSaved:(next:CompetitionDto)=>void;
}){
  const {t,isRTL}=useLocale();
  const [awards,setAwards]=useState<CompetitionRewardDto[]>(()=>competition.rewards.slice());
  const [category,setCategory]=useState<Category>("TEAM");
  const [title,setTitle]=useState("");
  const [prize,setPrize]=useState("");
  const [description,setDescription]=useState("");
  const [editing,setEditing]=useState<number|null>(null);
  const [dirty,setDirty]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const locked=competition.status==="ARCHIVED"||competition.status==="CANCELLED";

  function resetEditor(){
    setEditing(null);setCategory("TEAM");setTitle("");setPrize("");setDescription("");
  }
  function saveDraft(){
    if(locked)return;
    const item:CompetitionRewardDto={
      category,title:title.trim(),prize:prize.trim(),description:description.trim()||null,
    };
    if(item.title.length<2||item.title.length>90||item.prize.length<2||item.prize.length>240
      ||description.trim().length>500){
      setError(t("competition.rewards.invalid"));return;
    }
    if(awards.some((award,index)=>index!==editing&&award.category===item.category
      &&award.title.toLocaleLowerCase()===item.title.toLocaleLowerCase())){
      setError(t("competition.rewards.duplicate"));return;
    }
    if(editing===null&&awards.length>=30){
      setError(t("competition.rewards.limit"));return;
    }
    setAwards(current=>editing===null?[...current,item]:
      current.map((existing,index)=>index===editing?item:existing));
    setDirty(true);setMessage(null);setError(null);resetEditor();
  }
  function edit(index:number){
    const item=awards[index];
    if(!item)return;
    setEditing(index);setCategory(item.category);
    setTitle(item.title);setPrize(item.prize);setDescription(item.description??"");
    setError(null);setMessage(null);
  }
  function remove(index:number){
    setAwards(current=>current.filter((_,i)=>i!==index));
    if(editing!==null)resetEditor();
    setDirty(true);setMessage(null);setError(null);
  }
  async function publish(){
    if(!dirty||busy||locked)return;
    setBusy(true);setError(null);setMessage(null);
    try{
      const result=await competitionApi.replaceRewards(token,competition.id,{rewards:awards});
      setAwards(result.competition.rewards);
      setDirty(false);
      onSaved(result.competition);
      setMessage(t("competition.rewards.saved"));
    }catch{setError(t("competition.rewards.saveError"));}
    finally{setBusy(false);}
  }
  const byCategory=(kind:Category)=>awards.map((reward,index)=>({...reward,index}))
    .filter(reward=>reward.category===kind);
  return <View style={styles.stack} testID="competition-owner-rewards">
    <Card style={styles.card}>
      <View style={[styles.titleRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.icon}><Ionicons name="gift-outline" size={24} color={colors.primary}/></View>
        <View style={{flex:1,gap:3}}>
          <AppText variant="bodyLarge" weight="bold">{t("competition.rewards.title")}</AppText>
          <AppText variant="caption" muted>{t("competition.rewards.description")}</AppText>
        </View>
      </View>
      {locked?<AppText style={{color:colors.danger}}>{t("competition.rewards.locked")}</AppText>:null}
      {categories.map(kind=>{
        const items=byCategory(kind);
        return <View key={kind} style={styles.stack}>
          <AppText variant="bodyLarge" weight="semibold">{t(`competition.rewards.category.${kind}`)}</AppText>
          {items.length===0?<AppText muted variant="caption">{t("competition.rewards.noCategoryRewards")}</AppText>:null}
          {items.map(item=><View key={item.index} style={styles.award}>
            <View style={[styles.titleRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Ionicons name="trophy-outline" color={colors.primary} size={21}/>
              <View style={{flex:1,gap:3}}>
                <AppText weight="bold">{item.title}</AppText>
                <AppText weight="semibold" style={{color:colors.primary}}>{item.prize}</AppText>
                {item.description?<AppText variant="caption" muted>{item.description}</AppText>:null}
              </View>
            </View>
            {!locked?<View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Button label={t("competition.rewards.edit")} variant="secondary"
                disabled={busy} style={{flex:1}} onPress={()=>edit(item.index)}/>
              <Button label={t("competition.rewards.remove")} variant="ghost"
                disabled={busy} style={{flex:1}} onPress={()=>remove(item.index)}/>
            </View>:null}
          </View>)}
        </View>;
      })}
      {dirty?<AppText variant="caption" style={{color:colors.primary}}>
        {t("competition.rewards.unsaved")}
      </AppText>:null}
      {error?<AppText accessibilityRole="alert" style={{color:colors.danger}}>{error}</AppText>:null}
      {message?<AppText accessibilityLiveRegion="polite" style={{color:colors.success}}>{message}</AppText>:null}
      {!locked?<Button label={t("competition.rewards.publish")} onPress={()=>void publish()}
        loading={busy} disabled={!dirty||busy}/>:null}
    </Card>
    {!locked?<Card style={styles.card}>
      <AppText weight="bold" variant="bodyLarge">{t(editing===null?"competition.rewards.add":"competition.rewards.edit")}</AppText>
      <AppText variant="caption" muted>{t("competition.rewards.formHint")}</AppText>
      <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
        {categories.map(kind=><Pressable key={kind} accessibilityRole="radio"
          accessibilityState={{selected:category===kind}}
          onPress={()=>{setCategory(kind);setError(null);}}
          style={[styles.typeChoice,category===kind&&styles.typeSelected]}>
          <Ionicons name={kind==="TEAM"?"people-outline":"person-outline"} size={18}
            color={category===kind?colors.primary:colors.textMuted}/>
          <AppText weight="semibold" variant="caption" numberOfLines={1} style={{flexShrink:1}}>
            {t(`competition.rewards.category.${kind}`)}
          </AppText>
        </Pressable>)}
      </View>
      <TextField label={t("competition.rewards.name")} value={title} onChangeText={setTitle}
        placeholder={t("competition.rewards.titleExample")} maxLength={90}/>
      <TextField label={t("competition.rewards.prize")} value={prize} onChangeText={setPrize}
        placeholder={t("competition.rewards.prizeExample")} maxLength={240}/>
      <TextField label={t("competition.rewards.details")} value={description}
        onChangeText={setDescription} multiline maxLength={500}/>
      <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Button label={t(editing===null?"competition.rewards.add":"competition.rewards.apply")}
          onPress={saveDraft} disabled={busy} style={{flex:1}}/>
        {editing!==null?<Button label={t("common.cancel")} variant="secondary"
          onPress={resetEditor} style={{flex:1}}/>:null}
      </View>
    </Card>:null}
  </View>;
}
const styles=StyleSheet.create({
  stack:{gap:spacing.md},
  card:{gap:spacing.md},
  titleRow:{gap:spacing.sm,alignItems:"center"},
  icon:{width:45,height:45,borderRadius:14,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  award:{gap:spacing.sm,backgroundColor:colors.surfaceMuted,
    borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md},
  actions:{gap:spacing.sm},
  typeChoice:{flex:1,minHeight:50,paddingHorizontal:spacing.sm,alignItems:"center",
    justifyContent:"center",gap:5,flexDirection:"row",borderWidth:1,
    borderColor:colors.border,borderRadius:radius.md,backgroundColor:colors.surface},
  typeSelected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
});
