import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { ApiRequestError } from "../../../src/lib/api";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { TextField } from "../../../src/components/ui/TextField";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";

type Field="displayName"|"profileImageUrl"|"age"|"email"|"city"|"bio";
type FieldErrors=Partial<Record<Field,string>>;

export default function AccountProfileScreen(){
  const {session,updateProfile}=useAuth();
  const {t,isRTL}=useLocale();
  const user=session?.user;

  const [displayName,setDisplayName]=useState("");
  const [profileImageUrl,setProfileImageUrl]=useState("");
  const [age,setAge]=useState("");
  const [email,setEmail]=useState("");
  const [city,setCity]=useState("");
  const [bio,setBio]=useState("");
  const [fieldErrors,setFieldErrors]=useState<FieldErrors>({});
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  const [formError,setFormError]=useState<string|null>(null);

  useEffect(()=>{
    if(!user) return;
    setDisplayName(user.displayName===user.username?"":user.displayName);
    setProfileImageUrl(user.profileImageUrl??"");
    setAge(user.age?String(user.age):"");
    setEmail(user.email??"");
    setCity(user.city??"");
    setBio(user.bio??"");
  },[user]);

  const previewImage=useMemo(()=>{
    const value=profileImageUrl.trim();
    return value.startsWith("https://")?value:null;
  },[profileImageUrl]);

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
    const image=profileImageUrl.trim();
    const emailValue=email.trim();
    const cityValue=city.trim();
    const bioValue=bio.trim();

    if(name.length<2) next.displayName=t("validation.displayName");
    if(image&&!/^https:\/\/\S+$/i.test(image)) next.profileImageUrl=t("profile.imageInvalid");

    if(age.trim()){
      const numeric=Number(age);
      if(!Number.isInteger(numeric)||numeric<1||numeric>120) next.age=t("profile.ageInvalid");
    }

    if(emailValue&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) next.email=t("profile.emailInvalid");
    if(cityValue.length>80) next.city=t("profile.cityInvalid");
    if(bioValue.length>280) next.bio=t("profile.bioInvalid");

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
        profileImageUrl:profileImageUrl.trim(),
        age:age.trim()?Number(age):null,
        email:email.trim(),
        city:city.trim(),
        bio:bio.trim(),
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

      <TextField
        label={t("profile.image")}
        placeholder="https://example.com/profile.jpg"
        hint={t("profile.imageHint")}
        error={fieldErrors.profileImageUrl}
        value={profileImageUrl}
        onChangeText={(value)=>{setProfileImageUrl(value);clearFieldError("profileImageUrl");}}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        forceLtr
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
  </Screen>;
}

const styles=StyleSheet.create({
  previewCard:{flexDirection:"row",alignItems:"center",gap:spacing.md,padding:spacing.lg},
  avatar:{width:76,height:76,borderRadius:38,backgroundColor:colors.surfaceMuted},
  avatarFallback:{width:76,height:76,borderRadius:38,alignItems:"center",justifyContent:"center",backgroundColor:colors.primarySoft,borderWidth:2,borderColor:"#C7D7F7"},
  formCard:{gap:spacing.md,padding:spacing.lg},
  bioInput:{minHeight:96,textAlignVertical:"top"},
  statusBox:{alignItems:"center",gap:spacing.sm,padding:spacing.sm,borderRadius:radius.md,backgroundColor:"#F0FBF4"},
});
