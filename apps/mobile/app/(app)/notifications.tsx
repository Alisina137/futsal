import { colors, spacing } from "@leaguekick/design-tokens";
import type { NotificationDto, NotificationPreferences } from "@leaguekick/contracts";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Switch, View } from "react-native";
import { notificationApi } from "../../src/lib/api";
import { AppText } from "../../src/components/ui/AppText";
import { Button } from "../../src/components/ui/Button";
import { Card } from "../../src/components/ui/Card";
import { Screen } from "../../src/components/ui/Screen";
import { useAuth } from "../../src/providers/AuthProvider";
import { useLocale } from "../../src/providers/LocaleProvider";

const defaultPreferences:NotificationPreferences={
  inAppEnabled:true,
  pushEnabled:true,
  promotionsEnabled:true,
  venuePostsEnabled:true,
  teamInvitesEnabled:true,
};

export default function NotificationsScreen(){
  const {session}=useAuth();
  const {t,isRTL}=useLocale();
  const [items,setItems]=useState<NotificationDto[]>([]);
  const [preferences,setPreferences]=useState<NotificationPreferences>(defaultPreferences);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!session)return;
    setLoading(true);setError(null);
    try{
      const [list,prefs]=await Promise.all([
        notificationApi.list(session.accessToken),
        notificationApi.preferences(session.accessToken),
      ]);
      setItems(list.notifications);
      setPreferences(prefs.preferences);
    }catch{
      setError(t("notifications.loadError"));
    }finally{setLoading(false);}
  },[session,t]);

  useEffect(()=>{void load();},[load]);

  async function updatePreference(key:keyof NotificationPreferences,value:boolean){
    if(!session)return;
    const previous=preferences;
    const next={...preferences,[key]:value};
    setPreferences(next);
    try{
      const result=await notificationApi.updatePreferences(session.accessToken,{[key]:value});
      setPreferences(result.preferences);
    }catch{
      setPreferences(previous);
      setError(t("notifications.preferenceError"));
    }
  }

  async function openNotification(item:NotificationDto){
    if(!session)return;
    try{
      if(!item.readAt){
        const result=await notificationApi.markRead(session.accessToken,item.id);
        setItems((current)=>current.map((entry)=>entry.id===item.id?result.notification:entry));
      }
    }catch{}

    if(item.type==="SLOT_PROMOTION"){
      const venueId=typeof item.data.venueId==="string"?item.data.venueId:null;
      const promotionId=typeof item.data.promotionId==="string"?item.data.promotionId:null;
      if(venueId){
        router.push({pathname:"/venues/[venueId]",params:{venueId,...(promotionId?{promotionId}:{})}});
      }
      return;
    }
    if(item.type==="VENUE_POST"){
      const postId=typeof item.data.postId==="string"?item.data.postId:null;
      if(postId)router.push({pathname:"/posts/[postId]",params:{postId}});
      return;
    }
    router.push("/bookings");
  }

  function title(item:NotificationDto){
    return t(`notifications.type.${item.type}` as never);
  }

  function body(item:NotificationDto){
    return t(`notifications.body.${item.type}` as never);
  }

  return <Screen>
    <View style={{gap:spacing.xs}}>
      <AppText variant="title" weight="bold">{t("notifications.title")}</AppText>
      <AppText muted>{t("notifications.subtitle")}</AppText>
    </View>

    <Card>
      <AppText variant="bodyLarge" weight="bold">{t("notifications.preferences")}</AppText>
      {([
        ["inAppEnabled","notifications.inApp"],
        ["pushEnabled","notifications.push"],
        ["promotionsEnabled","notifications.promotions"],
        ["venuePostsEnabled","notifications.venuePosts"],
        ["teamInvitesEnabled","notifications.teamInvites"],
      ] as const).map(([key,label])=><View key={key} style={{flexDirection:isRTL?"row-reverse":"row",alignItems:"center",justifyContent:"space-between",gap:spacing.md}}>
        <AppText style={{flex:1}}>{t(label)}</AppText>
        <Switch value={preferences[key]} onValueChange={(value)=>void updatePreference(key,value)}/>
      </View>)}
    </Card>

    <Button label={t("common.retry")} onPress={()=>void load()} loading={loading} variant="secondary"/>
    {error?<Card><AppText style={{color:colors.danger}}>{error}</AppText></Card>:null}
    {!loading&&items.length===0?<Card><AppText>{t("notifications.empty")}</AppText></Card>:null}

    {items.map((item)=><Pressable key={item.id} onPress={()=>void openNotification(item)}>
      <Card style={!item.readAt?{borderColor:colors.primary,borderWidth:1}:undefined}>
        <AppText variant="bodyLarge" weight="bold">{title(item)}</AppText>
        <AppText>{body(item)}</AppText>
        <AppText variant="caption" muted forceLtr>{item.createdAt}</AppText>
        {!item.readAt?<AppText variant="caption" style={{color:colors.primary}} weight="bold">{t("notifications.unread")}</AppText>:null}
      </Card>
    </Pressable>)}
  </Screen>;
}
