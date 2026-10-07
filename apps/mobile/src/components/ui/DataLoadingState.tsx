import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, StyleSheet, View, type DimensionValue } from "react-native";

type LoadingVariant="list"|"detail"|"dashboard"|"form"|"calendar";

type Props={
  variant?:LoadingVariant;
  minHeight?:number;
};

export function DataLoadingState({variant="list",minHeight=360}:Props){
  const opacity=useRef(new Animated.Value(.42)).current;

  useEffect(()=>{
    const animation=Animated.loop(
      Animated.sequence([
        Animated.timing(opacity,{toValue:.86,duration:850,useNativeDriver:true}),
        Animated.timing(opacity,{toValue:.42,duration:850,useNativeDriver:true}),
      ]),
    );
    animation.start();
    return ()=>animation.stop();
  },[opacity]);

  return <View
    accessibilityRole="progressbar"
    accessibilityState={{busy:true}}
    style={[styles.root,{minHeight}]}
  >
    <Animated.View style={[styles.skeleton,{opacity}]}>
      {variant==="calendar"?<CalendarSkeleton/>
        :variant==="dashboard"?<DashboardSkeleton/>
          :variant==="detail"?<DetailSkeleton/>
            :variant==="form"?<FormSkeleton/>
              :<ListSkeleton/>}
    </Animated.View>

    <View pointerEvents="none" style={styles.loaderLayer}>
      <View style={styles.loaderBubble}>
        <ActivityIndicator size="small" color={colors.primary}/>
      </View>
    </View>
  </View>;
}

function CalendarSkeleton(){
  return <View style={styles.calendarSkeleton}>
    <View style={styles.calendarHeader}>
      <Skeleton width={58} height={18}/>
      {[0,1,2].map((item)=><Skeleton key={item} width="27%" height={34} radiusValue={radius.md}/>)}
    </View>
    {[0,1,2,3,4].map((row)=><View key={row} style={styles.calendarRow}>
      <Skeleton width={58} height={18}/>
      {[0,1,2].map((cell)=><Skeleton key={cell} width="27%" height={54} radiusValue={radius.md}/>)}
    </View>)}
  </View>;
}

function ListSkeleton(){
  return <View style={styles.stack}>
    <View style={styles.headingRow}>
      <Skeleton width="42%" height={24}/>
      <Skeleton width={82} height={34} radiusValue={radius.pill}/>
    </View>
    {[0,1,2].map((item)=><View key={item} style={styles.card}>
      <View style={styles.row}>
        <Skeleton width={46} height={46} radiusValue={14}/>
        <View style={styles.flexStack}>
          <Skeleton width="62%" height={18}/>
          <Skeleton width="38%" height={12}/>
        </View>
      </View>
      <Skeleton width="92%" height={12}/>
      <Skeleton width="70%" height={12}/>
    </View>)}
  </View>;
}

function DetailSkeleton(){
  return <View style={styles.stack}>
    <View style={styles.hero}>
      <Skeleton width={78} height={78} radiusValue={39}/>
      <Skeleton width="58%" height={24}/>
      <Skeleton width="38%" height={14}/>
    </View>
    <View style={styles.row}>
      <View style={[styles.card,styles.flexCard]}>
        <Skeleton width={38} height={38} radiusValue={12}/>
        <Skeleton width="60%" height={18}/>
        <Skeleton width="42%" height={12}/>
      </View>
      <View style={[styles.card,styles.flexCard]}>
        <Skeleton width={38} height={38} radiusValue={12}/>
        <Skeleton width="60%" height={18}/>
        <Skeleton width="42%" height={12}/>
      </View>
    </View>
    <View style={styles.card}>
      <Skeleton width="46%" height={20}/>
      <Skeleton width="94%" height={12}/>
      <Skeleton width="82%" height={12}/>
      <Skeleton width="68%" height={12}/>
    </View>
  </View>;
}

function DashboardSkeleton(){
  return <View style={styles.stack}>
    <View style={styles.row}>
      <View style={[styles.card,styles.flexCard]}>
        <Skeleton width={40} height={40} radiusValue={12}/>
        <Skeleton width="55%" height={22}/>
        <Skeleton width="44%" height={12}/>
      </View>
      <View style={[styles.card,styles.flexCard]}>
        <Skeleton width={40} height={40} radiusValue={12}/>
        <Skeleton width="55%" height={22}/>
        <Skeleton width="44%" height={12}/>
      </View>
    </View>
    {[0,1,2].map((item)=><View key={item} style={styles.card}>
      <Skeleton width="52%" height={20}/>
      <Skeleton width="88%" height={12}/>
      <Skeleton width="72%" height={12}/>
      <Skeleton width="100%" height={44} radiusValue={radius.md}/>
    </View>)}
  </View>;
}

function FormSkeleton(){
  return <View style={styles.stack}>
    {[0,1,2,3].map((item)=><View key={item} style={styles.fieldGroup}>
      <Skeleton width="34%" height={13}/>
      <Skeleton width="100%" height={54} radiusValue={radius.md}/>
    </View>)}
    <Skeleton width="100%" height={48} radiusValue={radius.md}/>
  </View>;
}

function Skeleton({
  width,
  height,
  radiusValue=radius.sm,
}:{
  width:DimensionValue;
  height:number;
  radiusValue?:number;
}){
  return <View style={[styles.block,{width,height,borderRadius:radiusValue}]}/>;
}

const styles=StyleSheet.create({
  root:{
    position:"relative",
    width:"100%",
    justifyContent:"flex-start",
  },
  skeleton:{
    width:"100%",
  },
  stack:{
    width:"100%",
    gap:spacing.md,
  },
  calendarSkeleton:{
    width:"100%",
    gap:spacing.xs,
    padding:spacing.xs,
    borderWidth:1,
    borderColor:colors.border,
    borderRadius:radius.lg,
    backgroundColor:colors.surface,
  },
  calendarHeader:{
    minHeight:52,
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
    gap:spacing.xs,
    paddingHorizontal:spacing.xs,
  },
  calendarRow:{
    minHeight:64,
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
    gap:spacing.xs,
    paddingHorizontal:spacing.xs,
    borderTopWidth:1,
    borderTopColor:colors.border,
  },
  row:{
    flexDirection:"row",
    alignItems:"stretch",
    gap:spacing.sm,
  },
  headingRow:{
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
    gap:spacing.sm,
  },
  card:{
    padding:spacing.md,
    gap:spacing.sm,
    borderWidth:1,
    borderColor:colors.border,
    borderRadius:radius.lg,
    backgroundColor:colors.surface,
  },
  flexCard:{
    flex:1,
  },
  hero:{
    alignItems:"center",
    gap:spacing.sm,
    padding:spacing.lg,
    borderWidth:1,
    borderColor:colors.border,
    borderRadius:radius.lg,
    backgroundColor:colors.surface,
  },
  flexStack:{
    flex:1,
    gap:spacing.sm,
  },
  fieldGroup:{
    gap:spacing.xs,
  },
  block:{
    backgroundColor:colors.surfaceMuted,
  },
  loaderLayer:{
    ...StyleSheet.absoluteFill,
    alignItems:"center",
    justifyContent:"center",
  },
  loaderBubble:{
    width:48,
    height:48,
    borderRadius:24,
    alignItems:"center",
    justifyContent:"center",
    backgroundColor:colors.surface,
    borderWidth:1,
    borderColor:colors.border,
    shadowColor:"#000000",
    shadowOpacity:.08,
    shadowRadius:10,
    shadowOffset:{width:0,height:4},
    elevation:3,
  },
});