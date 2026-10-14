import Constants from "expo-constants";
import {router} from "expo-router";
import {useEffect} from "react";
import {AppState,Platform} from "react-native";
import {notificationApi} from "../lib/api";
import {publishNotificationUnread} from "../lib/notification-events";
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
    const refreshUnread=async()=>{
      try{
        const response=await notificationApi.list(accessToken);
        if(alive)publishNotificationUnread(accessToken,response.unreadCount);
      }catch{/* In-app inbox remains accessible when network is offline. */}
    };
    const navigateFromResponse=(data:Record<string,unknown>|undefined)=>{
      if(!alive)return;
      const url=data?.url;
      // Reject arbitrary/remote destinations. Only internal app paths are legal.
      if(typeof url!=="string"||!/^\/(notifications|bookings|dashboard|owner|support|competitions|venues|posts|teams)(\/[^?#]*)?(\?[^#]*)?$/.test(url))return;
      router.push(url as never);
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
        if(last)navigateFromResponse(last.notification.request.content.data as Record<string,unknown>);
        const prefs=await notificationApi.preferences(accessToken);
        if(!alive||!prefs.preferences.pushEnabled)return;
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
        if(!alive||!token)return;
        await notificationApi.registerDevice(accessToken,{
          expoPushToken:token,platform:Platform.OS==="ios"?"IOS":"ANDROID",
        });
        registeredToken=token;
        subscriptions.push(Notifications.addPushTokenListener(()=>{
          void Notifications.getExpoPushTokenAsync({projectId}).then(next=>{
            if(!alive||next.data===registeredToken)return;
            registeredToken=next.data;
            return notificationApi.registerDevice(accessToken,{
              expoPushToken:next.data,platform:Platform.OS==="ios"?"IOS":"ANDROID",
            });
          }).catch(()=>undefined);
        }));
      }catch(e){
        // Missing APNs/FCM credentials, unsupported environment and temporary
        // connectivity must not break the in-app notification center.
        if(__DEV__)console.warn("Push notifications not active:",e);
      }
    };
    void start();
    const appState=AppState.addEventListener("change",next=>{
      if(next==="active")void refreshUnread();
    });
    return ()=>{
      alive=false;
      appState.remove();
      for(const subscription of subscriptions)subscription.remove();
      if(registeredToken)void notificationApi.unregisterDevice(accessToken,registeredToken).catch(()=>undefined);
    };
  },[accessToken]);
  return null;
}
