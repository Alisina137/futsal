import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { OwnerVenueSettingsDto } from "@leaguekick/contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { ApiRequestError, ownerApi } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { DataLoadingState } from "../../../src/components/ui/DataLoadingState";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

type Section="GENERAL"|"BOOKING"|"COURT"|"ACCESS";
const sections:Section[]=["GENERAL","BOOKING","COURT","ACCESS"];
const DEFAULT_MAP_REGION={latitude:34.5553,longitude:69.2075,latitudeDelta:.08,longitudeDelta:.08};
type MapPoint={latitude:number;longitude:number};

export default function VenueSettingsScreen(){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const [locationPickerOpen,setLocationPickerOpen]=useState(false);
  const [draftMapPoint,setDraftMapPoint]=useState<MapPoint|null>(null);
  const [data,setData]=useState<OwnerVenueSettingsDto|null>(null);
  const [section,setSection]=useState<Section>("GENERAL");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const [publicPhone,setPublicPhone]=useState("");
  const [whatsappPhone,setWhatsappPhone]=useState("");
  const [latitude,setLatitude]=useState("");
  const [longitude,setLongitude]=useState("");
  const [courtName,setCourtName]=useState("");
  const [duration,setDuration]=useState("90");
  const [basePrice,setBasePrice]=useState("0");
  const [bookingMode,setBookingMode]=useState<"INSTANT"|"APPROVAL">("INSTANT");
  const [onlineBookingEnabled,setOnlineBookingEnabled]=useState(true);
  const [noticeMinutes,setNoticeMinutes]=useState("0");
  const [advanceDays,setAdvanceDays]=useState("30");
  const [cancellationPolicy,setCancellationPolicy]=useState("");

  const hydrate=useCallback((next:OwnerVenueSettingsDto)=>{
    setData(next);
    setPublicPhone(next.publicPhone);
    setWhatsappPhone(next.whatsappPhone??"");
    setLatitude(next.latitude===null?"":String(next.latitude));
    setLongitude(next.longitude===null?"":String(next.longitude));
    setCourtName(next.court.name);
    setDuration(String(next.court.defaultSessionDurationMinutes));
    setBasePrice(String(next.court.basePriceAfn));
    setBookingMode(next.bookingMode);
    setOnlineBookingEnabled(next.onlineBookingEnabled);
    setNoticeMinutes(String(next.minimumBookingNoticeMinutes));
    setAdvanceDays(String(next.maximumAdvanceBookingDays));
    setCancellationPolicy(next.cancellationPolicy);
  },[]);

  const load=useCallback(async()=>{
    if(!session)return;
    setLoading(true);setError(null);
    try{
      const result=await ownerApi.settings(session.accessToken);
      hydrate(result.settings);
    }catch{
      setError(t("venueSettings.loadError"));
    }finally{setLoading(false);}
  },[hydrate,session,t]);

  useFocusEffect(useCallback(()=>{void load();},[load]));

  const numeric=useMemo(()=>({
    duration:Number(duration),
    basePrice:Number(basePrice),
    notice:Number(noticeMinutes),
    advance:Number(advanceDays),
    latitude:latitude.trim()===""?null:Number(latitude),
    longitude:longitude.trim()===""?null:Number(longitude),
  }),[advanceDays,basePrice,duration,latitude,longitude,noticeMinutes]);

  const mapCoordinate=useMemo(()=>{
    if(numeric.latitude===null||numeric.longitude===null)return null;
    if(!Number.isFinite(numeric.latitude)||!Number.isFinite(numeric.longitude))return null;
    return {latitude:numeric.latitude,longitude:numeric.longitude};
  },[numeric.latitude,numeric.longitude]);

  function setMapPoint(point:{latitude:number;longitude:number}){
    const next={latitude:Number(point.latitude.toFixed(6)),longitude:Number(point.longitude.toFixed(6))};
    setLatitude(String(next.latitude));
    setLongitude(String(next.longitude));
  }

  function clearMapPoint(){
    setLatitude("");
    setLongitude("");
  }

  function openLocationPicker(){
    setDraftMapPoint(mapCoordinate);
    setLocationPickerOpen(true);
  }

  function confirmLocation(){
    if(!draftMapPoint)return;
    setMapPoint(draftMapPoint);
    setLocationPickerOpen(false);
  }

  function validate(){
    if(publicPhone.trim().length<9)return t("venueSettings.validation.phone");
    if(!courtName.trim())return t("venueSettings.validation.court");
    if(!Number.isInteger(numeric.duration)||numeric.duration<30||numeric.duration>240)return t("venueSettings.validation.duration");
    if(!Number.isInteger(numeric.basePrice)||numeric.basePrice<0)return t("venueSettings.validation.price");
    if(!Number.isInteger(numeric.notice)||numeric.notice<0||numeric.notice>10080)return t("venueSettings.validation.notice");
    if(!Number.isInteger(numeric.advance)||numeric.advance<1||numeric.advance>180)return t("venueSettings.validation.advance");
    if((numeric.latitude===null)!==(numeric.longitude===null))return t("venueSettings.validation.coordinates");
    if(numeric.latitude!==null&&(!Number.isFinite(numeric.latitude)||numeric.latitude < -90||numeric.latitude > 90))return t("venueSettings.validation.coordinates");
    if(numeric.longitude!==null&&(!Number.isFinite(numeric.longitude)||numeric.longitude < -180||numeric.longitude > 180))return t("venueSettings.validation.coordinates");
    if(cancellationPolicy.trim().length<8)return t("venueSettings.validation.policy");
    return null;
  }

  async function save(){
    if(!session||saving)return;
    const validation=validate();
    if(validation){setError(validation);return;}
    setSaving(true);setSaved(false);setError(null);
    try{
      const result=await ownerApi.updateSettings(session.accessToken,{
        publicPhone:publicPhone.trim(),
        whatsappPhone:whatsappPhone.trim(),
        latitude:numeric.latitude,
        longitude:numeric.longitude,
        courtName:courtName.trim(),
        defaultSessionDurationMinutes:numeric.duration,
        basePriceAfn:numeric.basePrice,
        bookingMode,
        onlineBookingEnabled,
        minimumBookingNoticeMinutes:numeric.notice,
        maximumAdvanceBookingDays:numeric.advance,
        cancellationPolicy:cancellationPolicy.trim(),
      });
      hydrate(result.settings);
      setSaved(true);
    }catch(cause){
      if(cause instanceof ApiRequestError&&cause.code==="INVALID_VENUE_PHONE")setError(t("venueSettings.validation.phone"));
      else if(cause instanceof ApiRequestError&&cause.code==="VENUE_SUSPENDED")setError(t("venueSettings.suspendedError"));
      else setError(t("venueSettings.saveError"));
    }finally{setSaving(false);}
  }

  if(loading)return <Screen embedded><DataLoadingState variant="dashboard" minHeight={620}/></Screen>;

  if(!data)return <Screen embedded>
    <Card style={styles.errorCard}><AppText style={{color:colors.danger}}>{error??t("venueSettings.loadError")}</AppText><Button label={t("common.retry")} onPress={()=>void load()} variant="secondary"/></Card>
  </Screen>;

  return <Screen embedded>
    <View style={[styles.hero,{flexDirection:isRTL?"row-reverse":"row"}]}>
      <View style={styles.heroIcon}><Ionicons name="settings-outline" size={28} color="#FFFFFF"/></View>
      <View style={{flex:1,gap:3,alignItems:isRTL?"flex-end":"flex-start"}}>
        <AppText variant="title" weight="bold" style={{color:"#FFFFFF"}}>{t("venueSettings.title")}</AppText>
        <AppText style={{color:"#DBEAFE"}}>{t("venueSettings.subtitle")}</AppText>
      </View>
    </View>

    <View style={styles.statusGrid}>
      <StatusCard icon="business-outline" label={t("venueSettings.venueStatus")} value={t(`venueSettings.status.${data.venueStatus}` as never)} good={data.venueStatus==="ACTIVE"}/>
      <StatusCard icon="shield-checkmark-outline" label={t("venueSettings.verification")} value={t(`venueSettings.verification.${data.verificationStatus}` as never)} good={data.verificationStatus==="VERIFIED"}/>
      <StatusCard icon="card-outline" label={t("venueSettings.subscription")} value={t(`owner.subscription.${data.subscription.state}` as never)} good={data.subscription.state==="ACTIVE"||data.subscription.state==="TRIAL"}/>
      <StatusCard icon="globe-outline" label={t("venueSettings.onlineBooking")} value={onlineBookingEnabled?t("venueSettings.enabled"):t("venueSettings.paused")} good={onlineBookingEnabled}/>
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {sections.map((item)=><Pressable key={item} onPress={()=>setSection(item)} style={[styles.tab,section===item&&styles.tabActive]}>
        <AppText variant="caption" weight="bold" style={section===item?styles.tabTextActive:undefined}>{t(`venueSettings.section.${item}` as never)}</AppText>
      </Pressable>)}
    </ScrollView>

    {error?<Card style={styles.errorCard}><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    {saved?<Card style={styles.successCard}><View style={styles.inline}><Ionicons name="checkmark-circle" size={20} color={colors.success}/><AppText weight="semibold" style={{color:colors.success}}>{t("venueSettings.saved")}</AppText></View></Card>:null}

    {section==="GENERAL"?<>
      <SectionTitle icon="business-outline" title={t("venueSettings.identityTitle")} body={data.identityLocked?t("venueSettings.identityLocked"):t("venueSettings.identityEditable")}/>
      <Card style={styles.card}>
        <ReadOnlyRow label={t("owner.venueName")} value={data.name}/>
        <ReadOnlyRow label={t("owner.province")} value={data.province}/>
        <ReadOnlyRow label={t("owner.city")} value={data.city}/>
        <ReadOnlyRow label={t("owner.address")} value={data.address}/>
        <ReadOnlyRow label={t("venueSettings.timezone")} value={data.timezone} ltr/>
        {!data.identityLocked?<Button label={t("venueSettings.editIdentity")} onPress={()=>router.push("/owner/onboarding")} variant="secondary"/>:null}
      </Card>

      <SectionTitle icon="call-outline" title={t("venueSettings.contactTitle")} body={t("venueSettings.contactBody")}/>
      <Card style={styles.card}>
        <TextField label={t("owner.publicPhone")} value={publicPhone} onChangeText={setPublicPhone} keyboardType="phone-pad" forceLtr/>
        <TextField label={t("owner.whatsappPhone")} value={whatsappPhone} onChangeText={setWhatsappPhone} keyboardType="phone-pad" forceLtr/>
      </Card>

      <SectionTitle icon="location-outline" title={t("venueSettings.mapTitle")} body={t("venueSettings.mapBody")}/>
      <Card style={styles.card}>
        {/* Keep the map action BESIDE the two coordinate inputs, not above an embedded map. */}
        <View style={[styles.coordinateSelector,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.coordinateFields}>
            <TextField label={t("venueSettings.latitude")} value={latitude} editable={false} forceLtr containerStyle={styles.coordinateField}/>
            <TextField label={t("venueSettings.longitude")} value={longitude} editable={false} forceLtr containerStyle={styles.coordinateField}/>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("venueSettings.chooseOnMap")}
            accessibilityHint={t("venueSettings.mapPickSubtitle")}
            onPress={openLocationPicker}
            style={({pressed})=>[styles.coordinateMapButton,pressed&&styles.coordinateMapButtonPressed]}
          >
            <Ionicons name="map-outline" size={27} color="#FFFFFF"/>
            <AppText variant="caption" weight="bold" style={styles.coordinateMapButtonLabel}>
              {t("venueSettings.mapButton")}
            </AppText>
          </Pressable>
        </View>

        <View style={[styles.mapActions,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={{flex:1}}>
            <AppText variant="caption" muted>{mapCoordinate?t("venueSettings.coordinatesSelected"):t("venueSettings.coordinatesHint")}</AppText>
          </View>
          {mapCoordinate?<Pressable
            accessibilityRole="button"
            onPress={clearMapPoint}
            style={({pressed})=>[styles.clearMapButton,pressed&&{opacity:.7}]}
          >
            <Ionicons name="close-circle-outline" size={18} color={colors.danger}/>
            <AppText variant="caption" weight="semibold" style={{color:colors.danger}}>{t("venueSettings.clearLocation")}</AppText>
          </Pressable>:null}
        </View>
      </Card>
    </>:null}

    {section==="BOOKING"?<>
      <SectionTitle icon="globe-outline" title={t("venueSettings.onlineTitle")} body={t("venueSettings.onlineBody")}/>
      <Card style={styles.card}>
        <View style={[styles.switchRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={{flex:1,gap:2}}>
            <AppText weight="bold">{t("venueSettings.acceptOnline")}</AppText>
            <AppText variant="caption" muted>{onlineBookingEnabled?t("venueSettings.acceptOnlineOn"):t("venueSettings.acceptOnlineOff")}</AppText>
          </View>
          <Switch value={onlineBookingEnabled} onValueChange={setOnlineBookingEnabled}/>
        </View>
      </Card>

      <SectionTitle icon="checkmark-done-outline" title={t("venueSettings.approvalTitle")} body={t("venueSettings.approvalBody")}/>
      <Card style={styles.card}>
        <ChoiceRow
          options={[
            {value:"INSTANT" as const,label:t("venueSettings.instant"),body:t("venueSettings.instantBody"),icon:"flash-outline" as const},
            {value:"APPROVAL" as const,label:t("venueSettings.approval"),body:t("venueSettings.approvalModeBody"),icon:"hourglass-outline" as const},
          ]}
          value={bookingMode}
          onChange={setBookingMode}
          isRTL={isRTL}
        />
        {bookingMode==="APPROVAL"?<View style={styles.infoBox}><Ionicons name="information-circle-outline" size={19} color={colors.primary}/><AppText variant="caption" style={{flex:1}}>{t("venueSettings.approvalHint")}</AppText></View>:null}
      </Card>

      <SectionTitle icon="time-outline" title={t("venueSettings.bookingWindowTitle")} body={t("venueSettings.bookingWindowBody")}/>
      <Card style={styles.card}>
        <TextField label={t("venueSettings.minimumNotice")} value={noticeMinutes} onChangeText={setNoticeMinutes} keyboardType="number-pad" forceLtr hint={t("venueSettings.minimumNoticeHint")}/>
        <QuickNumbers values={[0,30,60,120,360]} current={numeric.notice} onSelect={(value)=>setNoticeMinutes(String(value))} suffix={t("venueSettings.minutes")}/>
        <TextField label={t("venueSettings.advanceDays")} value={advanceDays} onChangeText={setAdvanceDays} keyboardType="number-pad" forceLtr hint={t("venueSettings.advanceDaysHint")}/>
        <QuickNumbers values={[7,14,30,60,90]} current={numeric.advance} onSelect={(value)=>setAdvanceDays(String(value))} suffix={t("venueSettings.days")}/>
      </Card>

      <SectionTitle icon="document-text-outline" title={t("venueSettings.policyTitle")} body={t("venueSettings.policyBody")}/>
      <Card style={styles.card}>
        <TextField label={t("venueSettings.cancellationPolicy")} value={cancellationPolicy} onChangeText={setCancellationPolicy} multiline maxLength={1000}/>
        <AppText variant="caption" muted>{t("venueSettings.policySnapshotHint")}</AppText>
      </Card>
    </>:null}

    {section==="COURT"?<>
      <SectionTitle icon="football-outline" title={t("venueSettings.courtTitle")} body={t("venueSettings.courtBody")}/>
      <Card style={styles.card}>
        <TextField label={t("owner.areaName")} value={courtName} onChangeText={setCourtName}/>
        <TextField label={t("owner.durationMinutes")} value={duration} onChangeText={setDuration} keyboardType="number-pad" forceLtr/>
        <QuickNumbers values={[60,90,120]} current={numeric.duration} onSelect={(value)=>setDuration(String(value))} suffix={t("venueSettings.minutes")}/>
        <TextField label={t("owner.basePriceAfn")} value={basePrice} onChangeText={setBasePrice} keyboardType="number-pad" forceLtr/>
        <View style={styles.infoBox}><Ionicons name="information-circle-outline" size={19} color={colors.primary}/><AppText variant="caption" style={{flex:1}}>{t("venueSettings.priceOverrideHint")}</AppText></View>
      </Card>
      <ManagementLink icon="calendar-outline" title={t("venueSettings.manageTimetable")} body={t("venueSettings.manageTimetableBody")} onPress={()=>router.push("/owner/timetable/weekly")}/>
      <ManagementLink icon="calendar-number-outline" title={t("venueSettings.specialSchedule")} body={t("venueSettings.specialScheduleBody")} onPress={()=>router.push("/owner/timetable/exceptions")}/>
    </>:null}

    {section==="ACCESS"?<>
      <SectionTitle icon="shield-checkmark-outline" title={t("venueSettings.accessTitle")} body={t("venueSettings.accessBody")}/>
      <Card style={styles.card}>
        <ReadOnlyRow label={t("venueSettings.subscription")} value={t(`owner.subscription.${data.subscription.state}` as never)}/>
        <ReadOnlyRow label={t("venueSettings.accessMode")} value={t(`phase7.subscription.access.${data.subscription.accessMode}` as never)}/>
        <ReadOnlyRow label={t("venueSettings.verification")} value={t(`venueSettings.verification.${data.verificationStatus}` as never)}/>
        <ReadOnlyRow label={t("venueSettings.venueStatus")} value={t(`venueSettings.status.${data.venueStatus}` as never)}/>
      </Card>
      <ManagementLink icon="card-outline" title={t("venueSettings.manageSubscription")} body={t("venueSettings.manageSubscriptionBody")} onPress={()=>router.push("/owner/subscription")}/>
      <ManagementLink icon="images-outline" title={t("venueSettings.managePage")} body={t("venueSettings.managePageBody")} onPress={()=>router.push("/owner/posts")}/>
      <ManagementLink icon="people-outline" title={t("venueSettings.manageReferees")} body={t("venueSettings.manageRefereesBody")} onPress={()=>router.push("/owner/referees")}/>
      <ManagementLink icon="person-circle-outline" title={t("venueSettings.accountProfile")} body={t("venueSettings.accountProfileBody")} onPress={()=>router.push("/profile/account")}/>
      <Card style={styles.singleCourt}>
        <Ionicons name="information-circle-outline" size={21} color={colors.primary}/>
        <View style={{flex:1,gap:2}}>
          <AppText weight="bold">{t("venueSettings.singleCourtTitle")}</AppText>
          <AppText variant="caption" muted>{t("venueSettings.singleCourtBody")}</AppText>
        </View>
      </Card>
    </>:null}

    {section!=="ACCESS"?<Button label={t("venueSettings.save")} onPress={()=>void save()} loading={saving}/>:null}

    {locationPickerOpen?<Modal
      visible
      animationType="slide"
      onRequestClose={()=>setLocationPickerOpen(false)}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.mapModalSafe} edges={["top","bottom","left","right"]}>
        <View style={[styles.mapModalHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={{flex:1,gap:2}}>
            <AppText variant="bodyLarge" weight="bold">{t("venueSettings.mapTitle")}</AppText>
            <AppText variant="caption" muted>{t("venueSettings.mapPickSubtitle")}</AppText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t("venueSettings.cancelMapPicker")} onPress={()=>setLocationPickerOpen(false)} style={styles.mapModalClose}>
            <Ionicons name="close" size={24} color={colors.text}/>
          </Pressable>
        </View>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.fullMap}
          initialRegion={draftMapPoint?{...draftMapPoint,latitudeDelta:.012,longitudeDelta:.012}:DEFAULT_MAP_REGION}
          mapType="standard"
          onPress={(event)=>setDraftMapPoint(event.nativeEvent.coordinate)}
          showsCompass
          showsUserLocation={false}
          toolbarEnabled={false}
        >
          {draftMapPoint?<Marker
            coordinate={draftMapPoint}
            draggable
            title={data.name}
            description={t("venueSettings.mapMarkerHint")}
            onDragEnd={(event)=>setDraftMapPoint(event.nativeEvent.coordinate)}
          />:null}
        </MapView>
        <View style={styles.mapModalFooter}>
          <AppText variant="caption" muted>{draftMapPoint?t("venueSettings.coordinatesSelected"):t("venueSettings.mapTapHint")}</AppText>
          {draftMapPoint?<AppText weight="semibold" forceLtr>{draftMapPoint.latitude.toFixed(6)} , {draftMapPoint.longitude.toFixed(6)}</AppText>:null}
          <View style={[styles.mapModalButtons,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Button label={t("venueSettings.cancelMapPicker")} onPress={()=>setLocationPickerOpen(false)} variant="secondary" style={{flex:1}}/>
            <Button label={t("venueSettings.confirmOnMap")} onPress={confirmLocation} disabled={!draftMapPoint} style={{flex:1}}/>
          </View>
        </View>
      </SafeAreaView>
    </Modal>:null}
  </Screen>;
}

function StatusCard({icon,label,value,good}:{icon:keyof typeof Ionicons.glyphMap;label:string;value:string;good:boolean}){
  return <Card style={styles.statusCard}>
    <View style={[styles.statusIcon,{backgroundColor:good?"#ECFDF5":colors.surfaceMuted}]}><Ionicons name={icon} size={19} color={good?colors.success:colors.textMuted}/></View>
    <AppText variant="caption" muted>{label}</AppText>
    <AppText variant="caption" weight="bold" numberOfLines={1}>{value}</AppText>
  </Card>;
}

function SectionTitle({icon,title,body}:{icon:keyof typeof Ionicons.glyphMap;title:string;body:string}){
  return <View style={styles.sectionTitle}><View style={styles.sectionIcon}><Ionicons name={icon} size={20} color={colors.primary}/></View><View style={{flex:1,gap:2}}><AppText variant="bodyLarge" weight="bold">{title}</AppText><AppText variant="caption" muted>{body}</AppText></View></View>;
}

function ReadOnlyRow({label,value,ltr=false}:{label:string;value:string;ltr?:boolean}){
  return <View style={styles.readRow}><AppText variant="caption" muted>{label}</AppText><AppText weight="semibold" forceLtr={ltr}>{value}</AppText></View>;
}

function QuickNumbers({values,current,onSelect,suffix}:{values:number[];current:number;onSelect:(value:number)=>void;suffix:string}){
  return <View style={styles.quickRow}>{values.map((value)=><Pressable key={value} onPress={()=>onSelect(value)} style={[styles.quickChip,current===value&&styles.quickChipActive]}><AppText variant="caption" weight="semibold" style={current===value?{color:colors.primary}:undefined}>{value} {suffix}</AppText></Pressable>)}</View>;
}

function ChoiceRow<T extends string>({options,value,onChange,isRTL}:{options:Array<{value:T;label:string;body:string;icon:keyof typeof Ionicons.glyphMap}>;value:T;onChange:(value:T)=>void;isRTL:boolean}){
  return <View style={{gap:spacing.sm}}>{options.map((item)=><Pressable key={item.value} onPress={()=>onChange(item.value)} style={[styles.choice,value===item.value&&styles.choiceActive,{flexDirection:isRTL?"row-reverse":"row"}]}><View style={styles.choiceIcon}><Ionicons name={item.icon} size={21} color={value===item.value?colors.primary:colors.textMuted}/></View><View style={{flex:1,gap:2,alignItems:isRTL?"flex-end":"flex-start"}}><AppText weight="bold">{item.label}</AppText><AppText variant="caption" muted>{item.body}</AppText></View>{value===item.value?<Ionicons name="checkmark-circle" size={21} color={colors.primary}/>:null}</Pressable>)}</View>;
}

function ManagementLink({icon,title,body,onPress}:{icon:keyof typeof Ionicons.glyphMap;title:string;body:string;onPress:()=>void}){
  return <Pressable onPress={onPress} style={({pressed})=>[styles.managementLink,pressed&&{opacity:.72}]}><View style={styles.managementIcon}><Ionicons name={icon} size={21} color={colors.primary}/></View><View style={{flex:1,gap:2}}><AppText weight="bold">{title}</AppText><AppText variant="caption" muted>{body}</AppText></View><Ionicons name="chevron-forward" size={19} color={colors.textMuted}/></Pressable>;
}

const styles=StyleSheet.create({
  hero:{alignItems:"center",gap:spacing.md,padding:spacing.md,borderRadius:radius.lg,backgroundColor:"#0F3D8C"},
  heroIcon:{width:52,height:52,borderRadius:16,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.14)"},
  statusGrid:{flexDirection:"row",gap:spacing.xs,flexWrap:"wrap"},
  statusCard:{minWidth:"47%",flexGrow:1,gap:3,padding:spacing.sm},
  statusIcon:{width:32,height:32,borderRadius:10,alignItems:"center",justifyContent:"center"},
  tabs:{gap:spacing.xs,paddingVertical:2},
  tab:{minHeight:42,paddingHorizontal:spacing.md,borderRadius:radius.md,alignItems:"center",justifyContent:"center",backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  tabActive:{backgroundColor:colors.primary,borderColor:colors.primary},
  tabTextActive:{color:"#FFFFFF"},
  errorCard:{borderColor:colors.danger},
  successCard:{borderColor:"#BBF7D0",backgroundColor:"#F0FDF4"},
  inline:{flexDirection:"row",alignItems:"center",gap:spacing.xs},
  sectionTitle:{flexDirection:"row",alignItems:"center",gap:spacing.sm,marginTop:spacing.xs},
  sectionIcon:{width:40,height:40,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  card:{gap:spacing.md},
  coordinateSelector:{alignItems:"stretch",gap:spacing.sm},
  coordinateFields:{flex:1,minWidth:0,gap:spacing.sm},
  coordinateField:{width:"100%"},
  coordinateMapButton:{width:106,minHeight:120,padding:spacing.sm,borderRadius:radius.lg,backgroundColor:colors.primary,alignItems:"center",justifyContent:"center",gap:spacing.xs},
  coordinateMapButtonPressed:{opacity:.8},
  coordinateMapButtonLabel:{color:"#FFFFFF",textAlign:"center"},
  mapModalSafe:{flex:1,backgroundColor:colors.background},
  mapModalHeader:{alignItems:"center",gap:spacing.md,padding:spacing.md,backgroundColor:colors.surface,borderBottomWidth:1,borderBottomColor:colors.border},
  mapModalClose:{width:44,height:44,justifyContent:"center",alignItems:"center",borderRadius:radius.md,backgroundColor:colors.surfaceMuted},
  fullMap:{flex:1,width:"100%"},
  mapModalFooter:{gap:spacing.sm,padding:spacing.md,backgroundColor:colors.surface,borderTopWidth:1,borderTopColor:colors.border},
  mapModalButtons:{gap:spacing.sm},
  mapActions:{alignItems:"center",gap:spacing.sm},
  clearMapButton:{minHeight:38,flexDirection:"row",alignItems:"center",gap:4,paddingHorizontal:spacing.sm,borderRadius:radius.md,borderWidth:1,borderColor:"#FECACA",backgroundColor:"#FEF2F2"},
  readRow:{gap:2,paddingVertical:spacing.xs,borderBottomWidth:1,borderBottomColor:colors.border},
  switchRow:{alignItems:"center",gap:spacing.md},
  infoBox:{flexDirection:"row",gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:"#EFF6FF",borderWidth:1,borderColor:"#BFDBFE"},
  quickRow:{flexDirection:"row",flexWrap:"wrap",gap:spacing.xs},
  quickChip:{minHeight:36,paddingHorizontal:spacing.sm,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border,alignItems:"center",justifyContent:"center"},
  quickChipActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  choice:{alignItems:"center",gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,borderWidth:1,borderColor:colors.border},
  choiceActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},
  choiceIcon:{width:38,height:38,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:colors.surfaceMuted},
  managementLink:{minHeight:74,flexDirection:"row",alignItems:"center",gap:spacing.sm,padding:spacing.md,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},
  managementIcon:{width:42,height:42,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft},
  singleCourt:{flexDirection:"row",alignItems:"flex-start",gap:spacing.sm,backgroundColor:"#F8FBFF",borderColor:"#BFDBFE"},
});
