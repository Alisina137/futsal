import Ionicons from "@expo/vector-icons/Ionicons";
import {colors,radius,spacing} from "@leaguekick/design-tokens";
import type {CompetitionListItemDto,ManualTeamDto} from "@leaguekick/contracts";
import {router,useFocusEffect} from "expo-router";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {Modal,Pressable,ScrollView,StyleSheet,View} from "react-native";
import {ApiRequestError,competitionApi,manualTeamApi} from "../../../src/lib/api";
import {DirectoryFilterSelect} from "../../../src/components/social/DirectoryFilterSelect";
import {AppText} from "../../../src/components/ui/AppText";
import {Button} from "../../../src/components/ui/Button";
import {Card} from "../../../src/components/ui/Card";
import {DataLoadingState} from "../../../src/components/ui/DataLoadingState";
import {Screen} from "../../../src/components/ui/Screen";
import {TextField} from "../../../src/components/ui/TextField";
import {formatLocalDateTimeParts} from "../../../src/lib/date-time";
import {
  duplicateOfflineTeam,normalizeOfflineText,registerableOwnerCompetitions,searchOfflineTeams,
} from "../../../src/lib/owner-manual-teams";
import {useAuth} from "../../../src/providers/AuthProvider";
import {useLocale} from "../../../src/providers/LocaleProvider";

export default function OwnerManualTeamsScreen(){
  const {session}=useAuth();
  const {t,isRTL,language}=useLocale();
  const token=session?.accessToken;
  const userId=session?.user.id;
  const [teams,setTeams]=useState<ManualTeamDto[]>([]);
  const [loadedToken,setLoadedToken]=useState<string|null>(null);
  const serial=useRef(0);
  const registrationSerial=useRef(0);
  const currentActor=useRef(token);
  currentActor.current=token;

  const [formOpen,setFormOpen]=useState(false);
  const [name,setName]=useState("");
  const [city,setCity]=useState("");
  const [editingId,setEditingId]=useState<string|null>(null);
  const [busyToken,setBusyToken]=useState<string|null>(null);
  const busy=busyToken!==null&&busyToken===token;
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const [query,setQuery]=useState("");
  const [cityFilter,setCityFilter]=useState("");

  const [registerTeam,setRegisterTeam]=useState<ManualTeamDto|null>(null);
  const [competitions,setCompetitions]=useState<CompetitionListItemDto[]>([]);
  const [registrationLoadedToken,setRegistrationLoadedToken]=useState<string|null>(null);
  const [competitionId,setCompetitionId]=useState<string|null>(null);
  const [registrationLoading,setRegistrationLoading]=useState(false);
  const [registrationBusyToken,setRegistrationBusyToken]=useState<string|null>(null);
  const [registrationError,setRegistrationError]=useState<string|null>(null);
  const registering=registrationBusyToken!==null&&registrationBusyToken===token;

  const load=useCallback(async()=>{
    const request=++serial.current;
    if(!token){
      setTeams([]);setLoadedToken(null);setLoading(false);return;
    }
    setLoading(true);
    try{
      const result=await manualTeamApi.mine(token);
      if(request!==serial.current||currentActor.current!==token)return;
      setTeams(result.teams);setLoadedToken(token);setError(null);
    }catch{
      if(request===serial.current&&currentActor.current===token){
        setError(t("manualTeams.loadError"));
      }
    }finally{
      if(request===serial.current&&currentActor.current===token)setLoading(false);
    }
  },[token,t]);

  useFocusEffect(useCallback(()=>{
    void load();
    return()=>{
      serial.current++;
      registrationSerial.current++;
    };
  },[load]));

  useEffect(()=>{
    registrationSerial.current++;
    setFormOpen(false);setEditingId(null);setName("");setCity("");
    setQuery("");setCityFilter("");setMessage(null);setError(null);
    setRegisterTeam(null);setCompetitions([]);setCompetitionId(null);
    setRegistrationLoadedToken(null);setRegistrationError(null);
    setRegistrationLoading(false);
  },[userId,token]);

  const visibleTeams=loadedToken===token?teams:[];
  const filteredTeams=useMemo(
    ()=>searchOfflineTeams(visibleTeams,query,cityFilter),
    [visibleTeams,query,cityFilter],
  );
  const cities=useMemo(()=>[...new Set(visibleTeams.map(team=>team.city.trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b)).map(value=>({value,label:value})),[visibleTeams]);
  const duplicate=duplicateOfflineTeam(visibleTeams,name,city,editingId);
  const nameValid=name.trim().length>=2&&name.trim().length<=100;
  const cityValid=city.trim().length>=2&&city.trim().length<=80;
  const canSave=loadedToken===token&&nameValid&&cityValid&&!duplicate&&!busy;
  const eligibleCompetitions=useMemo(
    ()=>registerableOwnerCompetitions(competitions),[competitions],
  );

  function resetForm(){
    setFormOpen(false);setEditingId(null);setName("");setCity("");
  }
  function beginCreate(){
    setEditingId(null);setName("");setCity("");setFormOpen(true);
    setMessage(null);setError(null);
  }
  function beginEdit(team:ManualTeamDto){
    setEditingId(team.id);setName(team.name);setCity(team.city);
    setFormOpen(true);setMessage(null);setError(null);
  }

  async function save(){
    if(!session||!canSave||currentActor.current!==token)return;
    const actorToken=session.accessToken;
    const submitted={name:name.trim(),city:city.trim()};
    const teamBeingEdited=editingId;
    setBusyToken(actorToken);setError(null);setMessage(null);
    try{
      const {team}=teamBeingEdited
        ?await manualTeamApi.update(actorToken,teamBeingEdited,submitted)
        :await manualTeamApi.create(actorToken,submitted);
      if(actorToken!==currentActor.current)return;
      setTeams(previous=>teamBeingEdited
        ?previous.map(entry=>entry.id===team.id?team:entry)
        :[...previous,team]);
      setLoadedToken(actorToken);
      resetForm();setQuery("");setCityFilter("");
      setMessage(t("manualTeams.saved"));
    }catch(e){
      if(actorToken===currentActor.current){
        setError(e instanceof ApiRequestError?e.message:t("manualTeams.saveError"));
      }
    }finally{
      setBusyToken(current=>current===actorToken?null:current);
    }
  }

  function closeRegistration(){
    if(registering)return;
    registrationSerial.current++;
    setRegisterTeam(null);setCompetitionId(null);setRegistrationError(null);
    setRegistrationLoadedToken(null);setCompetitions([]);setRegistrationLoading(false);
  }
  async function openRegistration(team:ManualTeamDto){
    if(!token||loading||busy||registering)return;
    const request=++registrationSerial.current;
    const actorToken=token;
    setRegisterTeam(team);setCompetitions([]);setCompetitionId(null);
    setRegistrationLoadedToken(null);setRegistrationError(null);
    setRegistrationLoading(true);setError(null);setMessage(null);
    try{
      const result=await competitionApi.ownerList(actorToken);
      if(request!==registrationSerial.current||actorToken!==currentActor.current)return;
      setCompetitions(result.competitions);setRegistrationLoadedToken(actorToken);
    }catch{
      if(request===registrationSerial.current&&actorToken===currentActor.current){
        setRegistrationError(t("manualTeams.competitionsLoadError"));
      }
    }finally{
      if(request===registrationSerial.current&&actorToken===currentActor.current){
        setRegistrationLoading(false);
      }
    }
  }

  async function registerSelected(){
    if(!token||!registerTeam||!competitionId||registering
      ||registrationLoadedToken!==token
      ||!eligibleCompetitions.some(item=>item.id===competitionId))return;
    const actorToken=token;
    setRegistrationBusyToken(actorToken);setRegistrationError(null);
    try{
      await manualTeamApi.register(actorToken,competitionId,registerTeam.id);
      if(actorToken!==currentActor.current)return;
      setRegistrationBusyToken(null);
      closeRegistration();
      setMessage(t("manualTeams.registered"));
    }catch(e){
      if(actorToken===currentActor.current){
        if(e instanceof ApiRequestError){
          const known:Record<string,string>={
            REGISTRATION_EXISTS:"manualTeams.alreadyRegistered",
            COMPETITION_FULL:"manualTeams.competitionFull",
            COMPETITION_TEAM_LOCKED:"manualTeams.competitionLocked",
          };
          setRegistrationError(known[e.code]?t(known[e.code] as never):e.message);
        }else setRegistrationError(t("manualTeams.registrationError"));
      }
    }finally{
      setRegistrationBusyToken(current=>current===actorToken?null:current);
    }
  }

  return <Screen embedded refreshing={loading&&loadedToken===token} onRefresh={()=>void load()}>
    <View style={styles.intro}>
      <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.titleBlock}>
          <AppText variant="bodyLarge" weight="bold">{t("manualTeams.title")}</AppText>
          <AppText variant="caption" muted>{t("manualTeams.description")}</AppText>
        </View>
        <View style={styles.countBadge}>
          <Ionicons name="shield-checkmark-outline" size={19} color={colors.primary}/>
          <AppText weight="bold" style={{color:colors.primary}}>{visibleTeams.length}</AppText>
        </View>
      </View>
      <Button testID="offline-team-create-action" label={t("manualTeams.create")}
        disabled={busy||loadedToken!==token} onPress={beginCreate}
        icon={<Ionicons name="add-circle-outline" size={19} color="#FFFFFF"/>}/>
    </View>

    {formOpen?<Card testID="offline-team-editor" style={styles.formCard}>
      <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <AppText variant="bodyLarge" weight="bold" style={{flex:1}}>
          {t(editingId?"manualTeams.edit":"manualTeams.create")}
        </AppText>
        <Pressable testID="offline-team-editor-close" accessibilityRole="button"
          accessibilityLabel={t("common.cancel")} disabled={busy}
          onPress={resetForm} style={styles.iconButton}>
          <Ionicons name="close" size={21} color={colors.textMuted}/>
        </Pressable>
      </View>
      <TextField label={t("teams.name")} value={name} onChangeText={setName}
        maxLength={100} placeholder={t("teams.name")}/>
      <TextField label={t("teams.city")} value={city} onChangeText={setCity}
        maxLength={80} placeholder={t("teams.city")}/>
      {duplicate?<AppText variant="caption" style={{color:colors.danger}}>
        {t("manualTeams.duplicate")}
      </AppText>:null}
      <View style={[styles.actionRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Button testID="offline-team-save" style={styles.actionCell}
          label={t(editingId?"common.save":"manualTeams.create")}
          loading={busy} disabled={!canSave} onPress={()=>void save()}/>
        <Button style={styles.actionCell} label={t("common.cancel")} variant="secondary"
          disabled={busy} onPress={resetForm}/>
      </View>
    </Card>:null}

    {message?<View accessibilityLiveRegion="polite" style={[styles.feedback,styles.successFeedback]}>
      <Ionicons name="checkmark-circle-outline" color={colors.success} size={21}/>
      <AppText style={{color:colors.success,flex:1}}>{message}</AppText>
    </View>:null}
    {error?<Card style={styles.feedbackCard}>
      <View style={[styles.feedback,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="alert-circle-outline" size={22} color={colors.danger}/>
        <AppText style={{color:colors.danger,flex:1}}>{error}</AppText>
      </View>
      <Button variant="secondary" label={t("common.retry")} onPress={()=>void load()}/>
    </Card>:null}

    <Card style={styles.directoryCard}>
      <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <AppText weight="bold" variant="bodyLarge" style={{flex:1}}>
          {t("manualTeams.savedTeams")}
        </AppText>
        <AppText weight="semibold" variant="caption" style={{color:colors.primary}}>
          {visibleTeams.length}
        </AppText>
      </View>
      <TextField label={t("manualTeams.search")} placeholder={t("manualTeams.searchHint")}
        testID="offline-team-search" value={query} onChangeText={setQuery}
        maxLength={100}/>
      <View style={[styles.filterRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <View style={styles.filterCell}>
          <DirectoryFilterSelect compact testID="offline-team-city-filter"
            label={t("manualTeams.cityFilter")} value={cityFilter}
            allLabel={t("manualTeams.allCities")} options={cities}
            onSelect={setCityFilter}/>
        </View>
        <View style={styles.resultsCell}>
          <AppText variant="caption" muted>
            {t("manualTeams.results",{count:filteredTeams.length})}
          </AppText>
          {(query||cityFilter)?<Pressable testID="offline-team-clear-filters"
            accessibilityRole="button" onPress={()=>{setQuery("");setCityFilter("");}}>
            <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
              {t("manualTeams.clearFilters")}
            </AppText>
          </Pressable>:null}
        </View>
      </View>
    </Card>

    {loading&&loadedToken!==token?<DataLoadingState variant="list" minHeight={280}/>:null}
    {!loading&&loadedToken===token&&visibleTeams.length===0?<Card style={styles.emptyCard}>
      <Ionicons name="people-circle-outline" size={39} color={colors.primary}/>
      <AppText weight="bold">{t("manualTeams.empty")}</AppText>
      <AppText variant="caption" muted style={styles.centerText}>{t("manualTeams.emptyHint")}</AppText>
      <Button variant="secondary" label={t("manualTeams.create")} onPress={beginCreate}/>
    </Card>:null}
    {!loading&&loadedToken===token&&visibleTeams.length>0&&filteredTeams.length===0?
      <Card style={styles.emptyCard}>
        <Ionicons name="search-outline" size={34} color={colors.textMuted}/>
        <AppText weight="bold">{t("manualTeams.noMatches")}</AppText>
        <Button variant="secondary" label={t("manualTeams.clearFilters")}
          onPress={()=>{setQuery("");setCityFilter("");}}/>
      </Card>:null}

    {filteredTeams.map(team=>{
      const created=formatLocalDateTimeParts(team.createdAt,language);
      return <Card key={team.id} style={styles.teamCard}>
        <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.teamIcon}>
            <Ionicons name="shield-outline" size={24} color={colors.primary}/>
          </View>
          <View style={styles.teamText}>
            <AppText variant="bodyLarge" weight="bold" numberOfLines={2}>{team.name}</AppText>
            <View style={[styles.metaRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
              <Ionicons name="location-outline" color={colors.textMuted} size={15}/>
              <AppText variant="caption" muted numberOfLines={1}>{team.city}</AppText>
            </View>
          </View>
          <Pressable testID={`offline-team-edit-${team.id}`} accessibilityRole="button"
            accessibilityLabel={t("manualTeams.edit")+": "+team.name}
            disabled={busy} onPress={()=>beginEdit(team)} style={styles.editAction}>
            <Ionicons name="create-outline" size={21} color={colors.primary}/>
          </Pressable>
        </View>
        <View style={styles.divider}/>
        <View style={[styles.detailsRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.statusPill}>
            <Ionicons name="cloud-offline-outline" size={14} color={colors.primary}/>
            <AppText variant="caption" weight="semibold" style={{color:colors.primary}}>
              {t("manualTeams.offlineLabel")}
            </AppText>
          </View>
          <AppText variant="caption" muted>{t("manualTeams.created")} · {created.date}</AppText>
        </View>
        <AppText variant="caption" muted>{t("manualTeams.offlineStatus")}</AppText>
        <Button testID={`offline-team-register-${team.id}`} variant="secondary"
          label={t("manualTeams.registerDirect")}
          disabled={busy||registering} onPress={()=>void openRegistration(team)}
          icon={<Ionicons name="trophy-outline" size={18} color={colors.primary}/>}/>
      </Card>;
    })}

    <Modal transparent visible={!!registerTeam} animationType="fade"
      onRequestClose={closeRegistration}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")}
          style={StyleSheet.absoluteFill} onPress={closeRegistration}/>
        <View style={styles.modalCard}>
          <View style={[styles.heading,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <View style={styles.titleBlock}>
              <AppText variant="bodyLarge" weight="bold">{t("manualTeams.registerDirect")}</AppText>
              <AppText variant="caption" muted numberOfLines={2}>{registerTeam?.name}</AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")}
              disabled={registering} onPress={closeRegistration} style={styles.iconButton}>
              <Ionicons name="close" size={22} color={colors.text}/>
            </Pressable>
          </View>
          <AppText variant="caption" muted>{t("manualTeams.registerDirectHint")}</AppText>
          {registrationLoading?<DataLoadingState variant="list" minHeight={170}/>:null}
          {registrationError?<AppText accessibilityLiveRegion="polite"
            style={{color:colors.danger}}>{registrationError}</AppText>:null}
          {!registrationLoading&&registrationLoadedToken===token&&eligibleCompetitions.length===0?
            <View style={styles.emptyCompetitions}>
              <Ionicons name="calendar-outline" color={colors.textMuted} size={26}/>
              <AppText style={styles.centerText}>{t("manualTeams.noEligibleCompetitions")}</AppText>
            </View>:null}
          {!registrationLoading&&registrationLoadedToken===token?
            <ScrollView style={styles.competitionList} contentContainerStyle={{gap:spacing.sm}}
              keyboardShouldPersistTaps="handled">
              {eligibleCompetitions.map(item=>{
                const selected=competitionId===item.id;
                return <Pressable key={item.id}
                  testID={`offline-team-comp-${item.id}`} accessibilityRole="button"
                  accessibilityState={{selected}} disabled={registering}
                  onPress={()=>{setCompetitionId(item.id);setRegistrationError(null);}}
                  style={[styles.competitionOption,selected&&styles.optionSelected,
                    {flexDirection:isRTL?"row-reverse":"row"}]}>
                  <View style={{flex:1,minWidth:0,gap:4}}>
                    <AppText weight="semibold" numberOfLines={2}>{item.name}</AppText>
                    <AppText variant="caption" muted>
                      {t(`competition.status.${item.status}` as never)}
                      {" · "}{item.acceptedTeams}/{item.maxTeams} {t("competition.control.teams")}
                    </AppText>
                  </View>
                  <Ionicons name={selected?"checkmark-circle":"ellipse-outline"}
                    size={23} color={selected?colors.primary:colors.textMuted}/>
                </Pressable>;
              })}
            </ScrollView>:null}
          <View style={[styles.actionRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Button style={styles.actionCell} variant="secondary"
              label={t("common.cancel")} disabled={registering} onPress={closeRegistration}/>
            <Button testID="offline-team-confirm-registration" style={styles.actionCell}
              label={t("manualTeams.registerDirect")} loading={registering}
              disabled={!competitionId||registrationLoading||registrationLoadedToken!==token}
              onPress={()=>void registerSelected()}/>
          </View>
          {registrationError&&!registrationLoading&&registrationLoadedToken!==token?
            <Button variant="ghost" label={t("common.retry")}
              onPress={()=>{if(registerTeam)void openRegistration(registerTeam);}}/>:null}
        </View>
      </View>
    </Modal>
  </Screen>;
}

const styles=StyleSheet.create({
  intro:{gap:spacing.md},
  heading:{alignItems:"center",gap:spacing.sm},
  titleBlock:{flex:1,minWidth:0,gap:spacing.xs},
  countBadge:{alignItems:"center",flexDirection:"row",gap:spacing.xs,
    borderRadius:radius.pill,paddingHorizontal:spacing.md,minHeight:42,
    backgroundColor:colors.primarySoft},
  formCard:{gap:spacing.md,borderColor:colors.primary,borderWidth:1},
  directoryCard:{gap:spacing.md},
  filterRow:{alignItems:"center",gap:spacing.md},
  filterCell:{flex:1,minWidth:0},
  resultsCell:{flex:1,alignItems:"flex-end",gap:spacing.xs,minWidth:0},
  teamCard:{gap:spacing.md,padding:spacing.md,borderWidth:1,borderColor:colors.border},
  teamIcon:{width:51,height:51,borderRadius:radius.md,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  teamText:{flex:1,minWidth:0,gap:5},
  metaRow:{alignItems:"center",gap:4},
  editAction:{width:44,height:44,alignItems:"center",justifyContent:"center",
    borderRadius:radius.md,backgroundColor:colors.primarySoft},
  divider:{height:1,backgroundColor:colors.border},
  detailsRow:{alignItems:"center",justifyContent:"space-between",gap:spacing.sm,flexWrap:"wrap"},
  statusPill:{flexDirection:"row",alignItems:"center",gap:spacing.xs,
    paddingHorizontal:spacing.sm,paddingVertical:6,borderRadius:radius.pill,
    backgroundColor:colors.primarySoft},
  actionRow:{gap:spacing.sm},
  actionCell:{flex:1,minWidth:0},
  iconButton:{width:44,height:44,alignItems:"center",justifyContent:"center"},
  feedback:{alignItems:"center",gap:spacing.sm,flexDirection:"row"},
  feedbackCard:{gap:spacing.sm},
  successFeedback:{padding:spacing.md,borderRadius:radius.md,backgroundColor:colors.primarySoft},
  emptyCard:{gap:spacing.md,alignItems:"center",padding:spacing.lg},
  centerText:{textAlign:"center"},
  overlay:{flex:1,justifyContent:"center",padding:spacing.md,
    backgroundColor:"rgba(15,23,42,.60)"},
  modalCard:{width:"100%",maxWidth:480,maxHeight:"83%",alignSelf:"center",
    gap:spacing.md,padding:spacing.md,
    backgroundColor:colors.surface,borderRadius:radius.lg},
  competitionList:{flexGrow:0,minHeight:0},
  competitionOption:{minHeight:70,alignItems:"center",gap:spacing.sm,
    padding:spacing.md,borderRadius:radius.md,
    borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},
  optionSelected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  emptyCompetitions:{alignItems:"center",gap:spacing.sm,paddingVertical:spacing.lg},
});
