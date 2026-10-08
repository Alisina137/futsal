import { useEffect, useState } from "react";
import { AppState } from "react-native";

// Shared by each feed/screen rather than running a timer for every post card.
// Refreshes timestamps every minute and immediately on return to the app.
export function usePostTimeNow():number{
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{
    const timer=setInterval(()=>setNow(Date.now()),60_000);
    const listener=AppState.addEventListener("change",state=>{
      if(state==="active")setNow(Date.now());
    });
    return ()=>{
      clearInterval(timer);
      listener.remove();
    };
  },[]);
  return now;
}
