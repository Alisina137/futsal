import {useCallback,useEffect,useRef} from "react";
import type {LayoutChangeEvent} from "react-native";
import {ScrollView} from "react-native";

/**
 * Keeps the selected item of a horizontal nav visible on initial mount,
 * when switching tabs (including via deep link), and after RTL / size changes.
 *
 * Tab onLayout x is measured in the scroll content's physical coordinates,
 * so the same clamped calculation works for row and row-reverse layouts.
 * The selected tab is centered where the content width permits.
 */
export function tabFocusOffset(
  item:{x:number;width:number}|undefined,
  viewportWidth:number,
  contentWidth:number,
):number|null{
  if(!item||viewportWidth<=0||!Number.isFinite(item.x)||item.width<=0)return null;
  return Math.max(0,Math.min(
    Math.max(0,contentWidth-viewportWidth),
    item.x+item.width/2-viewportWidth/2,
  ));
}
export function useFocusedTabScroll(selectedKey:string){
  const scrollRef=useRef<ScrollView|null>(null);
  const viewportWidth=useRef(0);
  const contentWidth=useRef(0);
  const frames=useRef(new Map<string,{x:number;width:number}>());
  const focus=useCallback((key:string=selectedKey,animated=false)=>{
    const offset=tabFocusOffset(frames.current.get(key),
      viewportWidth.current,contentWidth.current);
    if(offset!==null)scrollRef.current?.scrollTo({x:offset,y:0,animated});
  },[selectedKey]);

  useEffect(()=>{
    const frame=requestAnimationFrame(()=>focus(selectedKey,false));
    return()=>cancelAnimationFrame(frame);
  },[selectedKey,focus]);

  const onLayout=useCallback((event:LayoutChangeEvent)=>{
    viewportWidth.current=event.nativeEvent.layout.width;
    focus(selectedKey,false);
  },[focus,selectedKey]);
  const onContentSizeChange=useCallback((width:number)=>{
    contentWidth.current=width;
    focus(selectedKey,false);
  },[focus,selectedKey]);
  const onTabLayout=useCallback((key:string,event:LayoutChangeEvent)=>{
    const {x,width}=event.nativeEvent.layout;
    frames.current.set(key,{x,width});
    if(key===selectedKey)focus(key,false);
  },[focus,selectedKey]);

  return {scrollRef,onLayout,onContentSizeChange,onTabLayout,focus};
}
