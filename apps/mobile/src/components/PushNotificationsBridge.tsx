import Constants from "expo-constants";
import {router} from "expo-router";
import {useEffect} from "react";
import {AppState,Platform} from "react-native";
import {notificationApi} from "../lib/api";
import {publishNotificationUnread} from "../lib/notification-events";
import {safeNotificationDeepLink} from "../lib/notification-routing";
import {onPushPreferenceChange} from "../lib/push-events";
import {useAuth} from "../providers/AuthProvider";

/**
 * Remote push requires a development/production build plus EAS project ID and
 * APNs/FCM credentials. Expo Go (SDK 57) can use the in-app inbox only.
 * Import the native module lazily to keep Expo Go/web safe.
 */
export function PushNotificationsBridge(){
  const {session,status}=useAuth();
  const accessToken=status==="authenticated"?session?.accessToken:undefined;
  useEffect(()=>{
    if(!accessToken||Platform.OS==="web"||Constants.appOwnership==="expo")return;
    let alive=true;
    let registeredToken:string|null=null;
    let subscriptions:Array<{remove:()=>void}>=[];
    let refreshDevice:(()=>Promise<void>)|null=null;
    const refreshUnread=async()=>{
      try{
        const response=await notificationApi.unreadCount(accessToken);
        if(alive)publishNotificationUnread(accessToken,response.unreadCount);
      }catch{/* In-app inbox remains accessible when network is offline. */}
    };
    const navigateFromResponse=(data:Record<string,unknown>|undefined)=>{
      if(!alive)return;
      const destination=safeNotificationDeepLink(data?.url);
      if(!destination)return;
      router.push(destination as never);
    };
    const start=async()=>{
      try{
        const Notifications=await import("expo-notifications");
        if(!alive)return;
        Notifications.setNotificationHandler({
          handleNotification:async()=>({
            shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false,
          }),
        });
        subscriptions.push(Notifications.addNotificationResponseReceivedListener(response=>{
          navigateFromResponse(response.notification.request.content.data as Record<string,unknown>);
        }));
        subscriptions.push(Notifications.addNotificationReceivedListener(()=>{void refreshUnread();}));
        const last=await Notifications.getLastNotificationResponseAsync();
        if(last){
          navigateFromResponse(last.notification.request.content.data as Record<string,unknown>);
          await Notifications.clearLastNotificationResponseAsync().catch(()=>undefined);
        }
        let registering=false;
        const syncDevice=async()=>{
          if(registering||!alive)return;
          registering=true;
          try{
            const prefs=await notificationApi.preferences(accessToken);
            if(!alive)return;
            if(!prefs.preferences.pushEnabled){
              if(registeredToken){
                const old=registeredToken;registeredToken=null;
                await notificationApi.unregisterDevice(accessToken,old).catch(()=>undefined);
              }
              return;
            }
            const projectId=Constants.easConfig?.projectId??Constants.expoConfig?.extra?.eas?.projectId;
            if(typeof projectId!=="string"||!projectId)return;
            if(Platform.OS==="android"){
              await Notifications.setNotificationChannelAsync("futsal-updates",{
                name:"Futsal updates",importance:Notifications.AndroidImportance.HIGH,
              });
            }
            const current=await Notifications.getPermissionsAsync();
            const permission=current.granted?current:await Notifications.requestPermissionsAsync();
            if(!permission.granted||!alive)return;
            const token=(await Notifications.getExpoPushTokenAsync({projectId})).data;
            if(!alive||!token||token===registeredToken)return;
            await notificationApi.registerDevice(accessToken,{
              expoPushToken:token,platform:Platform.OS==="ios"?"IOS":"ANDROID",
            });
            if(registeredToken)await notificationApi.unregisterDevice(accessToken,registeredToken).catch(()=>undefined);
            registeredToken=token;
          }catch(e){
            if(__DEV__)console.warn("Push registration not active:",e);
          }finally{registering=false;}
        };
        refreshDevice=syncDevice;
        await syncDevice();
        subscriptions.push(Notifications.addPushTokenListener(()=>{
          void syncDevice();
        }));
      }catch(e){
        // Missing APNs/FCM credentials, unsupported environment and temporary
        // connectivity must not break the in-app notification center.
        if(__DEV__)console.warn("Push notifications not active:",e);
      }
    };
    void start();
    const offPreference=onPushPreferenceChange(()=>{if(refreshDevice)void refreshDevice();});
    const appState=AppState.addEventListener("change",next=>{
      if(next==="active"){
        void refreshUnread();
        if(refreshDevice)void refreshDevice();
      }
    });
    return ()=>{
      alive=false;
      offPreference();
      appState.remove();
      for(const subscription of subscriptions)subscription.remove();
      if(registeredToken)void notificationApi.unregisterDevice(accessToken,registeredToken).catch(()=>undefined);
    };
  },[accessToken]);
  return null;
}
