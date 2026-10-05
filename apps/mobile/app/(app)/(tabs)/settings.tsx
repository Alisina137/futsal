import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { SelfAssignableRole } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { LanguagePicker } from "../../../src/components/LanguagePicker";
import { AppText } from "../../../src/components/ui/AppText";
import { Button } from "../../../src/components/ui/Button";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { useAuth } from "../../../src/providers/AuthProvider";
import { useLocale } from "../../../src/providers/LocaleProvider";
import { useNetwork } from "../../../src/providers/NetworkProvider";

type IconName = keyof typeof Ionicons.glyphMap;

export default function ProfileScreen(){
  const {session,signOut,revalidate,activateRole}=useAuth();
  const {t,isRTL,language}=useLocale();
  const {isOnline,hasResolved}=useNetwork();
  const [refreshing,setRefreshing]=useState(false);
  const [busyRole,setBusyRole]=useState<SelfAssignableRole|null>(null);
  const [roleError,setRoleError]=useState<string|null>(null);
  const user=session?.user;
  const owner=user?.roles.includes("VENUE_OWNER")??false;
  const player=user?.roles.includes("PLAYER")??false;
  const admin=user?.roles.includes("PLATFORM_ADMIN")??false;

  const initials=useMemo(()=>{
    const words=(user?.displayName??"LK").trim().split(/\s+/).filter(Boolean);
    return words.slice(0,2).map((word)=>word[0]?.toUpperCase()??"").join("")||"LK";
  },[user?.displayName]);

  const roles=user?.roles.length
    ?user.roles.map((role)=>t(("role."+role) as never)).join(", ")
    :t("roles.basicUser");
  const hasConfiguredDisplayName=Boolean(user?.displayName&&user.displayName!==user.username);
  const networkLabel=!hasResolved
    ?t("settings.connectionChecking")
    :isOnline
      ?t("settings.connectionOnline")
      :t("settings.connectionOffline");

  async function refreshSession(){
    setRefreshing(true);
    try{await revalidate();}
    finally{setRefreshing(false);}
  }

  async function selectRole(role:SelfAssignableRole){
    if(user?.roles.includes(role)) return;
    setBusyRole(role);
    setRoleError(null);
    try{
      await activateRole(role);
    }catch{
      setRoleError(t("roles.error"));
    }finally{
      setBusyRole(null);
    }
  }

  const direction={flexDirection:isRTL?"row-reverse":"row"} as const;

  return <Screen showHeader>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("profile.title")}</AppText>
      <AppText muted>{t("profile.subtitle")}</AppText>
    </View>

    <View style={styles.hero}>
      <View style={[styles.heroTop,direction]}>
        {user?.profileImageUrl
          ?<Image source={{uri:user.profileImageUrl}} style={styles.avatarImage}/>
          :<View style={styles.avatar}>
            <AppText variant="bodyLarge" weight="bold" style={{color:colors.primary}}>{initials}</AppText>
          </View>}
        <View style={styles.heroIdentity}>
          <AppText variant="bodyLarge" weight="bold" style={{color:"#FFFFFF"}}>{user?.displayName??""}</AppText>
          <AppText style={{color:"#DCE8FF"}} forceLtr>{user?.phone??""}</AppText>
          {user?.username?<AppText variant="caption" style={{color:"#DCE8FF"}} forceLtr>@{user.username}</AppText>:null}
        </View>
      </View>

      <View style={[styles.heroBadges,direction]}>
        <StatusBadge
          icon={isOnline?"wifi":"cloud-offline-outline"}
          label={networkLabel}
          positive={isOnline}
        />
        <StatusBadge
          icon="shield-checkmark-outline"
          label={t("settings.secureSession")}
          positive
        />
      </View>
    </View>

    <SectionHeader icon="person-circle-outline" title={t("settings.account")} subtitle={t("settings.accountSubtitle")} rtl={isRTL}/>
    <Card style={styles.sectionCard}>
      {hasConfiguredDisplayName?<><InfoRow icon="person-outline" label={t("auth.displayName")} value={user?.displayName??""} rtl={isRTL}/><Divider/></>:null}
      {user?.username?<><InfoRow icon="at-outline" label={t("settings.username")} value={`@${user.username}`} rtl={isRTL} ltr/><Divider/></>:null}
      <InfoRow icon="call-outline" label={t("auth.phone")} value={user?.phone??""} rtl={isRTL} ltr/>
      <Divider/>
      <InfoRow icon="id-card-outline" label={t("home.accountRole")} value={roles} rtl={isRTL}/>
      <Divider/>
      <ActionRow icon="create-outline" title={t("profile.accountEditTitle")} subtitle={t("profile.accountEditSubtitle")} rtl={isRTL} onPress={()=>router.push("/profile/account")}/>
    </Card>

    <SectionHeader icon="layers-outline" title={t("settings.roles")} subtitle={t("settings.rolesBody")} rtl={isRTL}/>
    <Card style={styles.sectionCard}>
      <RoleSelector
        activeRoles={user?.roles??[]}
        busyRole={busyRole}
        error={roleError}
        rtl={isRTL}
        t={t}
        onSelect={(role)=>void selectRole(role)}
      />
    </Card>

    <SectionHeader icon="options-outline" title={t("settings.preferences")} subtitle={t("settings.preferencesSubtitle")} rtl={isRTL}/>
    <Card style={styles.sectionCard}>
      <View style={{gap:spacing.md}}>
        <View style={[styles.settingLabelRow,direction]}>
          <IconBox name="language-outline"/>
          <View style={{flex:1,gap:2}}>
            <AppText weight="semibold">{t("settings.language")}</AppText>
            <AppText variant="caption" muted>{t("settings.languageBody")}</AppText>
          </View>
          <AppText variant="caption" weight="semibold" style={{color:colors.primary}} forceLtr>{language}</AppText>
        </View>
        <LanguagePicker/>
      </View>
      <Divider/>
      <ActionRow
        icon="notifications-outline"
        title={t("settings.notifications")}
        subtitle={t("settings.notificationsBody")}
        rtl={isRTL}
        onPress={()=>router.push("/notifications")}
      />
    </Card>

    <SectionHeader icon="shield-checkmark-outline" title={t("settings.security")} subtitle={t("settings.securitySubtitle")} rtl={isRTL}/>
    <Card style={styles.sectionCard}>
      <View style={[styles.securityBanner,direction]}>
        <IconBox name="lock-closed-outline" positive/>
        <View style={{flex:1,gap:2}}>
          <AppText weight="semibold">{t("settings.sessionProtectedTitle")}</AppText>
          <AppText variant="caption" muted>{t("settings.sessionProtected")}</AppText>
        </View>
      </View>
      <Button
        label={t("settings.refreshSession")}
        onPress={()=>void refreshSession()}
        loading={refreshing}
        variant="secondary"
        icon={<Ionicons name="refresh-outline" size={19} color={colors.primary}/>}
      />
    </Card>

    {admin?<Card style={styles.sectionCard}>
      <ActionRow icon="shield-outline" title={t("phase7.admin.title")} subtitle={t("phase7.admin.subtitle")} rtl={isRTL} onPress={()=>router.push("/admin")}/>
    </Card>:null}

    <SectionHeader icon="flash-outline" title={t("settings.quickAccess")} subtitle={t("settings.quickAccessSubtitle")} rtl={isRTL}/>
    <Card style={styles.sectionCard}>
      {owner?<>
        <ActionRow icon="time-outline" title={t("schedule.title")} subtitle={t("settings.ownerScheduleBody")} rtl={isRTL} onPress={()=>router.push("/schedule")}/>
        <Divider/>
        <ActionRow icon="card-outline" title={t("phase7.subscription.title")} subtitle={t("phase7.subscription.subtitle")} rtl={isRTL} onPress={()=>router.push("/owner/subscription")}/>
        <Divider/>
        <ActionRow icon="analytics-outline" title={t("phase7.analytics.title")} subtitle={t("phase7.analytics.subtitle")} rtl={isRTL} onPress={()=>router.push("/owner/analytics")}/>
        <Divider/>
        <ActionRow icon="trophy-outline" title={t("competition.ownerTitle")} subtitle={t("competition.ownerQuickAccessBody")} rtl={isRTL} onPress={()=>router.push("/owner/competitions")}/>
        <Divider/>
        <ActionRow icon="pricetag-outline" title={t("ownerMarketing.promotionsTitle")} subtitle={t("settings.ownerPromotionsBody")} rtl={isRTL} onPress={()=>router.push("/owner/promotions")}/>
        <Divider/>
        <ActionRow icon="megaphone-outline" title={t("ownerMarketing.postsTitle")} subtitle={t("settings.ownerPostsBody")} rtl={isRTL} onPress={()=>router.push("/owner/posts")}/>
      </>:player?<>
        <ActionRow icon="people-outline" title={t("teams.title")} subtitle={t("teams.quickAccessBody")} rtl={isRTL} onPress={()=>router.push("/teams")}/>
        <Divider/>
        <ActionRow icon="trophy-outline" title={t("competition.title")} subtitle={t("competition.quickAccessBody")} rtl={isRTL} onPress={()=>router.push("/competitions")}/>
        <Divider/>
        <ActionRow icon="football-outline" title={t("teams.profileTitle")} subtitle={t("teams.profileSubtitle")} rtl={isRTL} onPress={()=>router.push("/profile/player")}/>
        <Divider/>
        <ActionRow icon="business-outline" title={t("booking.venuesTitle")} subtitle={t("settings.playerVenuesBody")} rtl={isRTL} onPress={()=>router.push("/venues")}/>
        <Divider/>
        <ActionRow icon="calendar-outline" title={t("booking.myBookings")} subtitle={t("settings.playerBookingsBody")} rtl={isRTL} onPress={()=>router.push("/bookings")}/>
        <Divider/>
        <ActionRow icon="newspaper-outline" title={t("feed.title")} subtitle={t("settings.playerFeedBody")} rtl={isRTL} onPress={()=>router.push("/feed")}/>
      </>:<>
        <ActionRow icon="business-outline" title={t("booking.venuesTitle")} subtitle={t("settings.playerVenuesBody")} rtl={isRTL} onPress={()=>router.push("/venues")}/>
        <Divider/>
        <ActionRow icon="trophy-outline" title={t("competition.title")} subtitle={t("competition.quickAccessBody")} rtl={isRTL} onPress={()=>router.push("/competitions")}/>
        <Divider/>
        <ActionRow icon="newspaper-outline" title={t("feed.title")} subtitle={t("settings.playerFeedBody")} rtl={isRTL} onPress={()=>router.push("/feed")}/>
      </>}
    </Card>

    <SectionHeader icon="information-circle-outline" title={t("settings.app")} subtitle={t("settings.appSubtitle")} rtl={isRTL}/>
    <Card style={styles.sectionCard}>
      <InfoRow icon="football-outline" label={t("settings.product")} value={t("common.appName")} rtl={isRTL}/>
      <Divider/>
      <InfoRow icon="globe-outline" label={t("settings.region")} value={t("settings.regionValue")} rtl={isRTL}/>
      <Divider/>
      <InfoRow icon="cloud-outline" label={t("home.connection")} value={networkLabel} rtl={isRTL}/>
      <Divider/>
      <ActionRow icon="help-buoy-outline" title={t("support.title")} subtitle={t("support.subtitle")} rtl={isRTL} onPress={()=>router.push("/support")}/>
    </Card>

    <Card style={styles.signOutCard}>
      <View style={{gap:spacing.xs}}>
        <AppText weight="semibold">{t("settings.signOutTitle")}</AppText>
        <AppText variant="caption" muted>{t("settings.signOutBody")}</AppText>
      </View>
      <Button
        variant="danger"
        label={t("common.signOut")}
        onPress={()=>void signOut()}
        icon={<Ionicons name="log-out-outline" size={19} color="#FFFFFF"/>}
      />
    </Card>
  </Screen>;
}

function RoleSelector({
  activeRoles,
  busyRole,
  error,
  rtl,
  t,
  onSelect,
}:{
  activeRoles:string[];
  busyRole:SelfAssignableRole|null;
  error:string|null;
  rtl:boolean;
  t:(key:any,params?:Record<string,string|number>)=>string;
  onSelect:(role:SelfAssignableRole)=>void;
}){
  const options:Array<{role:SelfAssignableRole;icon:IconName;body:any}>=[
    {role:"PLAYER",icon:"football-outline",body:"roles.playerBody"},
    {role:"VENUE_OWNER",icon:"business-outline",body:"roles.ownerBody"},
    {role:"TEAM_MANAGER",icon:"people-outline",body:"roles.managerBody"},
    {role:"REFEREE",icon:"flag-outline",body:"roles.refereeBody"},
  ];

  return <View style={styles.roleList}>
    {options.map((option,index)=>{
      const active=activeRoles.includes(option.role);
      return <View key={option.role} style={styles.roleItem}>
        {index>0?<Divider/>:null}
        <View style={[styles.roleRow,{flexDirection:rtl?"row-reverse":"row"}]}>
          <IconBox name={option.icon} positive={active}/>
          <View style={styles.roleCopy}>
            <View style={[styles.roleTitleRow,{flexDirection:rtl?"row-reverse":"row"}]}>
              <AppText weight="semibold">{t(("role."+option.role) as any)}</AppText>
              {active?<View style={styles.activeRoleBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success}/>
                <AppText variant="caption" weight="semibold" style={{color:colors.success}}>{t("roles.active")}</AppText>
              </View>:null}
            </View>
            <AppText variant="caption" muted>{t(option.body)}</AppText>
          </View>
        </View>
        <Button
          label={active?t("roles.active"):t("roles.activate")}
          onPress={()=>onSelect(option.role)}
          loading={busyRole===option.role}
          disabled={active||busyRole!==null}
          variant={active?"secondary":"primary"}
        />
      </View>;
    })}
    {error?<AppText accessibilityRole="alert" style={styles.roleError}>{error}</AppText>:null}
  </View>;
}

function SectionHeader({icon,title,subtitle,rtl}:{icon:IconName;title:string;subtitle:string;rtl:boolean}){
  return <View style={[styles.sectionHeader,{flexDirection:rtl?"row-reverse":"row"}]}>
    <IconBox name={icon}/>
    <View style={{flex:1,gap:2}}>
      <AppText variant="bodyLarge" weight="bold">{title}</AppText>
      <AppText variant="caption" muted>{subtitle}</AppText>
    </View>
  </View>;
}

function ActionRow({icon,title,subtitle,rtl,onPress}:{icon:IconName;title:string;subtitle:string;rtl:boolean;onPress:()=>void}){
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={title}
    accessibilityHint={subtitle}
    onPress={onPress}
    style={({pressed})=>[
      styles.actionRow,
      {flexDirection:rtl?"row-reverse":"row"},
      pressed&&styles.actionPressed,
    ]}
  >
    <IconBox name={icon}/>
    <View style={{flex:1,gap:2}}>
      <AppText weight="semibold">{title}</AppText>
      <AppText variant="caption" muted>{subtitle}</AppText>
    </View>
    <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={20} color={colors.textMuted}/>
  </Pressable>;
}

function InfoRow({icon,label,value,rtl,ltr=false}:{icon:IconName;label:string;value:string;rtl:boolean;ltr?:boolean}){
  return <View style={[styles.infoRow,{flexDirection:rtl?"row-reverse":"row"}]}>
    <IconBox name={icon}/>
    <View style={{flex:1,gap:2}}>
      <AppText variant="caption" muted>{label}</AppText>
      <AppText weight="semibold" forceLtr={ltr}>{value}</AppText>
    </View>
  </View>;
}

function IconBox({name,positive=false}:{name:IconName;positive?:boolean}){
  return <View style={[styles.iconBox,positive&&styles.iconBoxPositive]}>
    <Ionicons name={name} size={20} color={positive?colors.success:colors.primary}/>
  </View>;
}

function StatusBadge({icon,label,positive}:{icon:IconName;label:string;positive:boolean}){
  return <View style={styles.statusBadge}>
    <Ionicons name={icon} size={15} color={positive?"#CFF8DD":"#FFFFFF"}/>
    <AppText variant="caption" weight="semibold" style={{color:"#FFFFFF"}}>{label}</AppText>
  </View>;
}

function Divider(){
  return <View style={styles.divider}/>;
}

const styles=StyleSheet.create({
  hero:{
    backgroundColor:colors.primary,
    borderRadius:radius.lg,
    padding:spacing.lg,
    gap:spacing.lg,
    shadowColor:colors.primary,
    shadowOpacity:0.2,
    shadowRadius:16,
    shadowOffset:{width:0,height:7},
    elevation:5,
  },
  heroTop:{
    alignItems:"center",
    gap:spacing.md,
  },
  avatarImage:{
    width:64,
    height:64,
    borderRadius:32,
    borderWidth:3,
    borderColor:"#BDD3FF",
    backgroundColor:"#FFFFFF",
  },
  avatar:{
    width:64,
    height:64,
    borderRadius:32,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:"#FFFFFF",
    borderWidth:3,
    borderColor:"#BDD3FF",
  },
  heroIdentity:{
    flex:1,
    gap:2,
  },
  heroBadges:{
    flexWrap:"wrap",
    gap:spacing.sm,
  },
  statusBadge:{
    minHeight:32,
    borderRadius:radius.pill,
    paddingHorizontal:spacing.md,
    flexDirection:"row",
    gap:spacing.xs,
    alignItems:"center",
    backgroundColor:"rgba(255,255,255,0.14)",
    borderWidth:1,
    borderColor:"rgba(255,255,255,0.18)",
  },
  sectionHeader:{
    alignItems:"center",
    gap:spacing.sm,
    marginTop:spacing.sm,
  },
  sectionCard:{
    gap:0,
    padding:spacing.md,
  },
  roleList:{
    gap:0,
  },
  roleItem:{
    gap:spacing.sm,
    paddingVertical:spacing.xs,
  },
  roleRow:{
    alignItems:"center",
    gap:spacing.sm,
    paddingVertical:spacing.sm,
  },
  roleCopy:{
    flex:1,
    gap:2,
  },
  roleTitleRow:{
    alignItems:"center",
    gap:spacing.xs,
    flexWrap:"wrap",
  },
  activeRoleBadge:{
    minHeight:24,
    paddingHorizontal:spacing.sm,
    borderRadius:radius.pill,
    backgroundColor:"#E9F8EF",
    flexDirection:"row",
    alignItems:"center",
    gap:4,
  },
  roleError:{
    color:colors.danger,
    marginTop:spacing.sm,
  },
  settingLabelRow:{
    alignItems:"center",
    gap:spacing.sm,
  },
  infoRow:{
    minHeight:58,
    alignItems:"center",
    gap:spacing.sm,
    paddingVertical:spacing.xs,
  },
  actionRow:{
    minHeight:66,
    alignItems:"center",
    gap:spacing.sm,
    paddingVertical:spacing.sm,
    borderRadius:radius.md,
  },
  actionPressed:{
    backgroundColor:colors.surfaceMuted,
  },
  iconBox:{
    width:40,
    height:40,
    borderRadius:radius.md,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:colors.primarySoft,
  },
  iconBoxPositive:{
    backgroundColor:"#E9F8EF",
  },
  divider:{
    height:1,
    backgroundColor:colors.border,
    marginVertical:spacing.xs,
    marginStart:52,
  },
  securityBanner:{
    alignItems:"center",
    gap:spacing.sm,
    paddingBottom:spacing.md,
  },
  signOutCard:{
    borderColor:"#F5C5C1",
    backgroundColor:"#FFF9F8",
    gap:spacing.md,
  },
});
