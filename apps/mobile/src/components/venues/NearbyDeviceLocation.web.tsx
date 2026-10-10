import {useEffect,useRef} from "react";
type Point={latitude:number;longitude:number};
type Props={onLocation:(point:Point)=>void;onError:()=>void};
/** Browser foreground geolocation never imports native react-native-maps. */
export function NearbyDeviceLocation({onLocation,onError}:Props){
  const callbacks=useRef({onLocation,onError});
  callbacks.current={onLocation,onError};
  useEffect(()=>{
    if(typeof navigator==="undefined"||!navigator.geolocation){
      callbacks.current.onError();return;
    }
    let active=true;
    navigator.geolocation.getCurrentPosition(
      result=>{if(active)callbacks.current.onLocation({
        latitude:result.coords.latitude,longitude:result.coords.longitude,
      });},
      ()=>{if(active)callbacks.current.onError();},
      {enableHighAccuracy:false,maximumAge:30000,timeout:9500},
    );
    return()=>{active=false;};
  },[]);
  return null;
}
