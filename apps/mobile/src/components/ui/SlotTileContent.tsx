import {useCallback,useMemo,useState} from "react";
import type {ReactNode} from "react";
import {StyleSheet,View,type LayoutChangeEvent} from "react-native";
import {AppText} from "./AppText";
import {formatSlotStartTime,formatSlotTilePrice} from "../../lib/slot-display";

type Props={
  startsAt:string;
  timeZone:string;
  priceAfn:number|null;
  ink:string;
  marker?:ReactNode;
};

/** A compact, two-tone diagonal slot face. The diagonal rises from bottom-left
 * to top-right, like the provided reference. Its dimensions follow the real
 * tile width, so customer/owner, Day/Week and RTL all share the same geometry.
 * Upper-left keeps the pale status background and dark text; lower-right uses
 * an opaque dark status color with a white price. The parent Pressable owns actions. */
export function SlotTileContent({startsAt,timeZone,priceAfn,ink,marker}:Props){
  const time=useMemo(()=>formatSlotStartTime(startsAt,timeZone),[startsAt,timeZone]);
  const [frame,setFrame]=useState({width:0,height:0});
  const onTileLayout=useCallback((event:LayoutChangeEvent)=>{
    const {width,height}=event.nativeEvent.layout;
    const w=Math.ceil(width),h=Math.ceil(height);
    if(w<=0||h<=0)return;
    setFrame(previous=>previous.width===w&&previous.height===h
      ?previous:{width:w,height:h});
  },[]);
  return <View style={styles.tile} onLayout={onTileLayout}>
    {/* Border-based right triangle fills the bottom-right half. The original
        status color remains visible in the upper-left triangle underneath. */}
    {frame.width>0&&frame.height>0?<View pointerEvents="none"
      style={[styles.diagonal,{
        borderLeftWidth:frame.width,
        borderBottomWidth:frame.height,
        borderBottomColor:ink,
      }]}/>:null}
    <View style={styles.header}>
      <AppText weight="bold" forceLtr numberOfLines={1}
        style={[styles.time,{color:ink}]}>{time}</AppText>
    </View>
    <AppText variant="caption" weight="semibold" forceLtr numberOfLines={1}
      style={styles.price}>{formatSlotTilePrice(priceAfn)}</AppText>
    {marker?<View pointerEvents="none" style={styles.marker}>{marker}</View>:null}
  </View>;
}

const styles=StyleSheet.create({
  tile:{width:"100%",minHeight:50,paddingHorizontal:4,paddingVertical:4,
    justifyContent:"space-between",gap:3,overflow:"hidden"},
  diagonal:{position:"absolute",top:0,left:0,width:0,height:0,
    borderLeftColor:"transparent",borderStyle:"solid"},
  header:{minHeight:17,alignSelf:"stretch",justifyContent:"flex-start",
    flexDirection:"row",paddingRight:19},
  time:{fontSize:12,lineHeight:17,textAlign:"left",alignSelf:"flex-start",writingDirection:"ltr"},
  price:{fontSize:11,lineHeight:15,color:"#FFFFFF",textAlign:"right",alignSelf:"flex-end",writingDirection:"ltr"},
  marker:{position:"absolute",top:2,right:2,minWidth:18,minHeight:18,
    backgroundColor:"rgba(255,255,255,0.95)",borderRadius:9,
    alignItems:"center",justifyContent:"center"},
});
