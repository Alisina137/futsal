import {useCallback,useEffect,useRef,useState} from "react";
import {PermissionsAndroid,Platform} from "react-native";
import {useLocale} from "../../providers/LocaleProvider";

export type VenueMapPoint={latitude:number;longitude:number};
type State="idle"|"asking"|"locating"|"ready"|"denied"|"timeout";
const valid=(point:VenueMapPoint)=>Number.isFinite(point.latitude)&&
  Number.isFinite(point.longitude)&&Math.abs(point.latitude)<=90&&
  Math.abs(point.longitude)<=180;

/** Foreground-only, opt-in GPS. Deadline includes Android permission wait.
 * A default profile position is reported as fallback, never as device GPS. */
export function useVenueMapLocation(defaultPoint:VenueMapPoint|null){
  const {t}=useLocale();
  const [state,setState]=useState<State>("idle");
  const [point,setPoint]=useState<VenueMapPoint|null>(null);
  const [source,setSource]=useState<"device"|"default"|null>(null);
  const [attempt,setAttempt]=useState(0);
  const settled=useRef(true);
  const deadline=useRef<ReturnType<typeof setTimeout>|null>(null);
  const cancelDeadline=useCallback(()=>{
    if(deadline.current!==null){clearTimeout(deadline.current);deadline.current=null;}
  },[]);
  useEffect(()=>()=>{settled.current=true;cancelDeadline();},[cancelDeadline]);
  const fallback=useCallback((reason:"denied"|"timeout")=>{
    if(settled.current)return;
    settled.current=true;cancelDeadline();
    if(defaultPoint&&valid(defaultPoint)){
      setPoint(defaultPoint);setSource("default");setState("ready");
    }else{
      setPoint(null);setSource(null);setState(reason);
    }
  },[cancelDeadline,defaultPoint]);
  const locate=useCallback(()=>{
    cancelDeadline();settled.current=false;
    setState("asking");setSource(null);setPoint(null);
    setAttempt(value=>value+1);
    deadline.current=setTimeout(()=>fallback("timeout"),10_000);
    void (async()=>{
      try{
        if(Platform.OS==="android"){
          const fine=PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
          const coarse=PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
          let granted=await PermissionsAndroid.check(fine)||await PermissionsAndroid.check(coarse);
          if(!granted){
            const answer=await PermissionsAndroid.request(fine,{
              title:t("booking.nearbyPermissionTitle"),
              message:t("booking.nearbyPermissionBody"),
              buttonPositive:"OK",buttonNegative:t("common.cancel"),
            });
            granted=answer===PermissionsAndroid.RESULTS.GRANTED||
              await PermissionsAndroid.check(coarse);
            if(!granted&&!settled.current){
              const answerCoarse=await PermissionsAndroid.request(coarse);
              granted=answerCoarse===PermissionsAndroid.RESULTS.GRANTED;
            }
          }
          if(!granted){fallback("denied");return;}
        }
        if(!settled.current)setState("locating");
      }catch{fallback("denied");}
    })();
  },[cancelDeadline,fallback,t]);
  const onLocation=useCallback((next:VenueMapPoint)=>{
    if(settled.current||!valid(next))return;
    settled.current=true;cancelDeadline();setPoint(next);setSource("device");setState("ready");
  },[cancelDeadline]);
  const onError=useCallback(()=>fallback("denied"),[fallback]);
  return {state,point,source,attempt,locate,onLocation,onError};
}
