import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { useEffect, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VenueLocationWebMap } from "../../../src/components/owner/VenueLocationWebMap";
import { ApiRequestError, resolveMediaImageUrl } from "../../../src/lib/api";
import { AccountAvatarPicker } from "../../../src/components/profile/AccountAvatarPicker";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

type Field="displayName"|"age"|"email"|"city"|"bio"|"defaultLocation";
type Point={latitude:number;longitude:number};
const validPoint=(latitude:string,longitude:string):Point|null=>{
  if(!latitude.trim()||!longitude.trim())return null;
  const lat=Number(latitude),lng=Number(longitude);
  return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180
    ?{latitude:lat,longitude:lng}:null;
};
type FieldErrors=Partial<Record<Field,string>>;

export default function AccountProfileScreen(){
  const {session,updateProfile,uploadProfileImage}=useAuth();
  const {t,isRTL}=useLocale();
  const user=session?.user;

  const [displayName,setDisplayName]=useState("");
  const [age,setAge]=useState("");
  const [email,setEmail]=useState("");
  const [city,setCity]=useState("");
  const [bio,setBio]=useState("");
  const [defaultLatitude,setDefaultLatitude]=useState("");
  const [defaultLongitude,setDefaultLongitude]=useState("");
  const [locationPickerOpen,setLocationPickerOpen]=useState(false);
  const [draftPoint,setDraftPoint]=useState<Point|null>(null);
  const [mapError,setMapError]=useState(false);
  const [fieldErrors,setFieldErrors]=useState<FieldErrors>({});
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  const [formError,setFormError]=useState<string|null>(null);

  useEffect(()=>{
    if(!user) return;
    setDisplayName(user.displayName===user.username?"":user.displayName);
    setAge(user.age?String(user.age):"");
    setEmail(user.email??"");
    setCity(user.city??"");
    setBio(user.bio??"");
    setDefaultLatitude(user.defaultLatitude===null?"":String(user.defaultLatitude));
    setDefaultLongitude(user.defaultLongitude===null?"":String(user.defaultLongitude));
  },[user?.id]);

  const previewImage=resolveMediaImageUrl(user?.profileImageUrl);

  function clearFieldError(field:Field){
    setFieldErrors((current)=>{
      if(!current[field]) return current;
      const next={...current};
      delete next[field];
      return next;
    });
    setFormError(null);
    setMessage(null);
  }

  function validate(){
    const next:FieldErrors={};
    const name=displayName.trim();
    const emailValue=email.trim();
    const cityValue=city.trim();
    const bioValue=bio.trim();

    if(name&&name.length<2) next.displayName=t("validation.displayName");

    if(age.trim()){
      const numeric=Number(age);
      if(!Number.isInteger(numeric)||numeric<1||numeric>120) next.age=t("profile.ageInvalid");
    }

    if(emailValue&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) next.email=t("profile.emailInvalid");
    if(cityValue.length>80) next.city=t("profile.cityInvalid");
    if(bioValue.length>280) next.bio=t("profile.bioInvalid");
    if((defaultLatitude.trim()!=="")||(defaultLongitude.trim()!=="")){
      if(!validPoint(defaultLatitude,defaultLongitude))
        next.defaultLocation=t("profile.defaultLocationInvalid");
    }

    setFieldErrors(next);
    return Object.keys(next).length===0;
  }

  async function save(){
    setMessage(null);
    setFormError(null);
    if(!validate()) return;

    setBusy(true);
    try{
      await updateProfile({
        displayName:displayName.trim(),
        age:age.trim()?Number(age):null,
        email:email.trim(),
        city:city.trim(),
        bio:bio.trim(),
        defaultLatitude:defaultLatitude.trim()?Number(defaultLatitude):null,
        defaultLongitude:defaultLongitude.trim()?Number(defaultLongitude):null,
      });
      setMessage(t("profile.profileSaved"));
    }catch(cause){
      if(cause instanceof ApiRequestError&&cause.code==="EMAIL_ALREADY_EXISTS"){
        setFieldErrors({email:t("profile.emailTaken")});
      }else{
        setFormError(t("auth.genericError"));
      }
    }finally{
      setBusy(false);
    }
  }

  const initials=(displayName||user?.username||"FT").slice(0,2).toUpperCase();

  return <Screen showHeader>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("profile.accountEditTitle")}</AppText>
      <AppText muted>{t("profile.accountEditSubtitle")}</AppText>
    </View>

    <Card style={styles.previewCard}>
      {previewImage
        ?<Image source={{uri:previewImage}} style={styles.avatar}/>
        :<View style={styles.avatarFallback}><AppText variant="title" weight="bold" style={{color:colors.primary}}>{initials}</AppText></View>}
      <View style={{flex:1,gap:2}}>
        <AppText weight="bold">{displayName||user?.username||""}</AppText>
        <AppText variant="caption" muted forceLtr>{user?.username?"@"+user.username:""}</AppText>
        <AppText variant="caption" muted forceLtr>{user?.phone??""}</AppText>
      </View>
    </Card>

    <Card style={styles.formCard}>
      <AppText variant="bodyLarge" weight="bold">{t("profile.personalInfo")}</AppText>
      <AppText variant="caption" muted>{t("profile.optionalHint")}</AppText>

      <TextField
        label={t("auth.displayName")}
        placeholder={t("auth.placeholderDisplayName")}
        hint={t("profile.fullNameHint")}
        error={fieldErrors.displayName}
        value={displayName}
        onChangeText={(value)=>{setDisplayName(value);clearFieldError("displayName");}}
        autoComplete="name"
      />

      <AccountAvatarPicker
        value={user?.profileImageUrl??null}
        onUpload={uploadProfileImage}
        disabled={busy}
      />

      <TextField
        label={t("profile.age")}
        placeholder={t("profile.agePlaceholder")}
        hint={t("profile.optional")}
        error={fieldErrors.age}
        value={age}
        onChangeText={(value)=>{setAge(value.replace(/[^0-9]/g,"").slice(0,3));clearFieldError("age");}}
        keyboardType="number-pad"
        forceLtr
      />

      <TextField
        label={t("profile.email")}
        placeholder={t("profile.emailPlaceholder")}
        hint={t("profile.optional")}
        error={fieldErrors.email}
        value={email}
        onChangeText={(value)=>{setEmail(value);clearFieldError("email");}}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        forceLtr
      />

      <TextField
        label={t("profile.city")}
        placeholder={t("profile.cityPlaceholder")}
        hint={t("profile.optional")}
        error={fieldErrors.city}
        value={city}
        onChangeText={(value)=>{setCity(value);clearFieldError("city");}}
        maxLength={80}
      />

      <Card style={styles.locationCard}>
        <View style={[styles.locationHeader,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={styles.locationIcon}><Ionicons name="location-outline" size={24} color={colors.primary}/></View>
          <View style={{flex:1,gap:3}}>
            <AppText weight="bold" variant="bodyLarge">{t("profile.defaultLocationTitle")}</AppText>
            <AppText variant="caption" muted>{t("profile.defaultLocationDescription")}</AppText>
          </View>
        </View>
        <View style={[styles.coordRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <TextField label={t("profile.latitude")} value={defaultLatitude}
            onChangeText={value=>{setDefaultLatitude(value);clearFieldError("defaultLocation");}}
            placeholder="34.5553" keyboardType="numbers-and-punctuation"
            forceLtr containerStyle={{flex:1}}/>
          <TextField label={t("profile.longitude")} value={defaultLongitude}
            onChangeText={value=>{setDefaultLongitude(value);clearFieldError("defaultLocation");}}
            placeholder="69.2075" keyboardType="numbers-and-punctuation"
            forceLtr containerStyle={{flex:1}}/>
        </View>
        {fieldErrors.defaultLocation?<AppText accessibilityRole="alert"
          style={{color:colors.danger}}>{fieldErrors.defaultLocation}</AppText>:null}
        <Button label={t("profile.chooseDefaultOnMap")}
          variant="secondary" icon={<Ionicons name="map-outline" size={20} color={colors.primary}/>}
          onPress={()=>{
            setDraftPoint(validPoint(defaultLatitude,defaultLongitude));
            setMapError(false);setLocationPickerOpen(true);
          }}/>
        {(defaultLatitude!==""||defaultLongitude!=="")?<Button
          label={t("profile.clearDefaultLocation")} variant="secondary"
          onPress={()=>{setDefaultLatitude("");setDefaultLongitude("");clearFieldError("defaultLocation");}}/>:null}
        <AppText variant="caption" muted>{t("profile.defaultLocationPrivacy")}</AppText>
      </Card>

      <TextField
        label={t("profile.bio")}
        placeholder={t("profile.bioPlaceholder")}
        hint={t("profile.bioHint")}
        error={fieldErrors.bio}
        value={bio}
        onChangeText={(value)=>{setBio(value);clearFieldError("bio");}}
        multiline
        numberOfLines={4}
        maxLength={280}
        style={styles.bioInput}
      />

      {message?<View style={[styles.statusBox,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Ionicons name="checkmark-circle" size={19} color={colors.success}/>
        <AppText accessibilityLiveRegion="polite" style={{flex:1,color:colors.success}}>{message}</AppText>
      </View>:null}

      {formError?<AppText accessibilityRole="alert" accessibilityLiveRegion="assertive" style={{color:colors.danger}}>{formError}</AppText>:null}

      <Button
        label={t("common.save")}
        onPress={()=>void save()}
        loading={busy}
        icon={<Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF"/>}
      />
    </Card>

    <Modal visible={locationPickerOpen} animationType="slide"
      onRequestClose={()=>setLocationPickerOpen(false)} statusBarTranslucent>
      <SafeAreaView edges={["top","bottom","left","right"]} style={styles.modalSafe}>
        <View style={[styles.modalTop,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <View style={{flex:1,gap:3}}>
            <AppText variant="bodyLarge" weight="bold">{t("profile.defaultLocationTitle")}</AppText>
            <AppText variant="caption" muted>{t("profile.tapMapToChoose")}</AppText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t("common.cancel")}
            style={styles.modalClose} onPress={()=>setLocationPickerOpen(false)}>
            <Ionicons name="close" size={24} color={colors.text}/>
          </Pressable>
        </View>
        <View style={styles.mapContainer}>
          <VenueLocationWebMap initialPoint={draftPoint}
            onPick={point=>{setDraftPoint(point);setMapError(false);}}
            onReady={()=>setMapError(false)}
            onFailed={()=>setMapError(true)}/>
        </View>
        <View style={styles.modalFooter}>
          {mapError?<AppText variant="caption" style={{color:colors.danger}}>
            {t("profile.mapUnavailable")}
          </AppText>:null}
          {draftPoint?<AppText forceLtr variant="caption" style={{textAlign:"center"}}>
            {draftPoint.latitude.toFixed(6)}, {draftPoint.longitude.toFixed(6)}
          </AppText>:null}
          <View style={[styles.modalButtons,{flexDirection:isRTL?"row-reverse":"row"}]}>
            <Button label={t("common.cancel")} variant="secondary" style={{flex:1}}
              onPress={()=>setLocationPickerOpen(false)}/>
            <Button label={t("profile.useThisLocation")} disabled={!draftPoint} style={{flex:1}}
              onPress={()=>{
                if(!draftPoint)return;
                setDefaultLatitude(String(Number(draftPoint.latitude.toFixed(6))));
                setDefaultLongitude(String(Number(draftPoint.longitude.toFixed(6))));
                clearFieldError("defaultLocation");setLocationPickerOpen(false);
              }}/>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  </Screen>;
}

const styles=StyleSheet.create({
  previewCard:{flexDirection:"row",alignItems:"center",gap:spacing.md,padding:spacing.lg},
  avatar:{width:76,height:76,borderRadius:38,backgroundColor:colors.surfaceMuted},
  avatarFallback:{width:76,height:76,borderRadius:38,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft,borderWidth:2,borderColor:"#C7D7F7"},
  formCard:{gap:spacing.md,padding:spacing.lg},
  bioInput:{minHeight:96,textAlignVertical:"top"},
  statusBox:{alignItems:"center",gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:"#F0FBF4"},
  locationCard:{gap:spacing.md,padding:spacing.md},
  locationHeader:{alignItems:"center",gap:spacing.sm},
  locationIcon:{width:42,height:42,borderRadius:21,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  coordRow:{gap:spacing.sm},
  modalSafe:{flex:1,backgroundColor:colors.surface},
  modalTop:{padding:spacing.md,alignItems:"center",gap:spacing.sm},
  modalClose:{height:44,width:44,borderRadius:22,backgroundColor:colors.primarySoft,
    alignItems:"center",justifyContent:"center"},
  mapContainer:{flex:1,minHeight:220,marginHorizontal:spacing.sm,overflow:"hidden",
    borderRadius:radius.md,borderWidth:1,borderColor:colors.border},
  modalFooter:{padding:spacing.md,gap:spacing.sm},
  modalButtons:{gap:spacing.sm},
});
