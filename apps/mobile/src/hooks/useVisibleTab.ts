import {useCallback,useEffect,useRef} from "react";
import type {ScrollView,LayoutChangeEvent} from "react-native";

/**
 * Keeps the currently selected tab centered in a horizontal navigation,
 * both on first paint and when the selection changes. Works for RTL since
 * React Native reports positions in the scroll content's layout coordinates.
 * Keys are UI identities, never indexes, so translation length has no effect.
 */
export function useVisibleTab<T extends string>(active:T){
  const scrollRef=useRef<ScrollView|null>(null);
  const viewport=useRef(0);
  const content=useRef(0);
  const cells=useRef(new Map<T,{x:number;width:number}>());
  const focus=useCallback((selected:T,animated=false)=>{
    const cell=cells.current.get(selected);
    if(!cell||viewport.current<=0)return;
    const x=Math.max(0,Math.min(Math.max(0,content.current-viewport.current),
      cell.x+cell.width/2-viewport.current/2));
    scrollRef.current?.scrollTo({x,y:0,animated});
  },[]);
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>focus(active));
    return()=>cancelAnimationFrame(frame);
  },[active,focus]);
  const onViewport=useCallback((event:LayoutChangeEvent)=>{
    viewport.current=event.nativeEvent.layout.width;
    focus(active);
  },[active,focus]);
  const onContentSize=useCallback((width:number)=>{
    content.current=width;
    focus(active);
  },[active,focus]);
  const cellLayout=useCallback((key:T,event:LayoutChangeEvent)=>{
    const {x,width}=event.nativeEvent.layout;
    cells.current.set(key,{x,width});
    if(active===key)focus(key);
  },[active,focus]);
  return {scrollRef,onViewport,onContentSize,cellLayout,focus};
}
