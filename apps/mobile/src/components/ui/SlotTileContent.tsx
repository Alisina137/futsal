import {StyleSheet,View} from "react-native";
import type {ReactNode} from "react";
import {useMemo} from "react";
import {AppText} from "./AppText";
import {formatSlotStartTime,formatSlotTilePrice} from "../../lib/slot-display";

type Props={
  startsAt:string;
  timeZone:string;
  priceAfn:number|null;
  ink:string;
  marker?:ReactNode;
};

/** Use inside the existing Pressable so booking, disabled and ownership rules
 * remain at the call site. Corners stay physically left/right even in RTL. */
export function SlotTileContent({startsAt,timeZone,priceAfn,ink,marker}:Props){
  const time=useMemo(()=>formatSlotStartTime(startsAt,timeZone),[startsAt,timeZone]);
  return <View style={styles.tile}>
    <View style={styles.header}>
      <AppText weight="bold" forceLtr numberOfLines={1}
        style={[styles.time,{color:ink}]}>{time}</AppText>
    </View>
    <View style={[styles.rule,{backgroundColor:ink}]}/>
    <AppText variant="caption" weight="semibold" forceLtr numberOfLines={1}
      style={[styles.price,{color:ink}]}>{formatSlotTilePrice(priceAfn)}</AppText>
    {marker?<View pointerEvents="none" style={styles.marker}>{marker}</View>:null}
  </View>;
}

const styles=StyleSheet.create({
  tile:{width:"100%",minHeight:50,paddingHorizontal:4,paddingVertical:4,
    justifyContent:"space-between",gap:3},
  header:{minHeight:17,alignSelf:"stretch",justifyContent:"flex-start",
    flexDirection:"row",paddingRight:19},
  time:{fontSize:12,lineHeight:17,textAlign:"left",alignSelf:"flex-start",writingDirection:"ltr"},
  rule:{height:1,width:"100%",opacity:.26},
  price:{fontSize:11,lineHeight:15,textAlign:"right",alignSelf:"flex-end",writingDirection:"ltr"},
  marker:{position:"absolute",top:3,right:2,minWidth:16,minHeight:16,
    alignItems:"center",justifyContent:"center"},
});
