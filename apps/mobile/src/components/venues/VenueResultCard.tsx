import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { resolveMediaImageUrl } from "../../lib/api";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "../ui/AppText";

type Props={
  id:string;
  name:string;
  city:string;
  province:string;
  imageUrl:string|null;
  onlineBookingEnabled?:boolean;
  testID?:string;
};

/**
 * Compact discovery result: a 25% media column and 75% content column.
 * The image is always a square and is centered if translated text grows.
 * Booking is a deep link to live availability, never an automatic reservation.
 */
export function VenueResultCard({id,name,city,province,imageUrl,onlineBookingEnabled,testID}:Props){
  const {t,isRTL}=useLocale();
  const image=resolveMediaImageUrl(imageUrl);
  const canReserve=onlineBookingEnabled!==false;
  const location=[city,province].filter(Boolean).join(", ");
  const openDetails=()=>router.push({pathname:"/venues/[venueId]",params:{venueId:id}});
  const openBooking=()=>router.push({pathname:"/venues/[venueId]",params:{venueId:id,focusAvailability:"1"}});

  return <View testID={testID??`venue-result-card-${id}`}
    style={[styles.card,{flexDirection:isRTL?"row-reverse":"row"}]}>
    <View style={styles.imageColumn}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${t("booking.venueDetails")}: ${name}`}
        onPress={openDetails} style={({pressed})=>[styles.imageButton,pressed&&styles.pressed]}>
        {image?<Image source={{uri:image}} style={styles.image} resizeMode="cover"/>:
          <View style={styles.imageFallback}>
            <Ionicons name="football-outline" size={28} color={colors.primary}/>
          </View>}
      </Pressable>
    </View>

    <View style={[styles.content,{paddingLeft:isRTL?spacing.sm:0,paddingRight:isRTL?0:spacing.sm}]}>
      <View style={styles.identity}>
        <Pressable accessibilityRole="button" accessibilityLabel={name} onPress={openDetails}>
          <AppText weight="bold" numberOfLines={2} style={styles.name}>{name}</AppText>
        </Pressable>
        <View style={[styles.locationRow,{flexDirection:isRTL?"row-reverse":"row"}]}>
          <Ionicons name="location-outline" size={15} color={colors.textMuted}/>
          <AppText variant="caption" muted numberOfLines={2} style={styles.locationText}>{location}</AppText>
        </View>
      </View>

      <View style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <Pressable testID={`venue-details-${id}`} accessibilityRole="button"
          accessibilityLabel={t("booking.venueDetails")} onPress={openDetails}
          style={({pressed})=>[styles.action,styles.detailsButton,pressed&&styles.pressed]}>
          <AppText variant="caption" weight="semibold" numberOfLines={2}
            style={styles.detailsLabel}>{t("booking.venueDetails")}</AppText>
        </Pressable>
        <Pressable testID={`venue-reserve-${id}`} accessibilityRole="button"
          accessibilityLabel={t("booking.reserveOnline")}
          accessibilityHint={!canReserve?t("booking.onlineBookingUnavailable"):undefined}
          accessibilityState={{disabled:!canReserve}} disabled={!canReserve}
          onPress={openBooking}
          style={({pressed})=>[styles.action,styles.reserveButton,!canReserve&&styles.reserveDisabled,pressed&&styles.pressed]}>
          <AppText variant="caption" weight="bold" numberOfLines={2}
            style={styles.reserveLabel}>{t("booking.reserveOnline")}</AppText>
        </Pressable>
      </View>
    </View>
  </View>;
}

const styles=StyleSheet.create({
  card:{
    width:"100%",minHeight:134,borderWidth:1,borderColor:colors.border,
    borderRadius:radius.lg,backgroundColor:colors.surface,overflow:"hidden",
  },
  imageColumn:{
    width:"25%",alignItems:"center",justifyContent:"center",
    paddingHorizontal:6,paddingVertical:spacing.sm,
  },
  imageButton:{
    width:"100%",maxWidth:112,aspectRatio:1,borderRadius:radius.md,
    overflow:"hidden",backgroundColor:colors.surfaceMuted,
  },
  image:{width:"100%",height:"100%"},
  imageFallback:{
    width:"100%",height:"100%",alignItems:"center",justifyContent:"center",
    backgroundColor:colors.primarySoft,
  },
  content:{width:"75%",minWidth:0,paddingVertical:spacing.sm,gap:spacing.sm,
    justifyContent:"space-between"},
  identity:{gap:4,minWidth:0},
  name:{fontSize:15,lineHeight:21},
  locationRow:{alignItems:"flex-start",gap:4,minWidth:0},
  locationText:{flex:1,minWidth:0},
  actions:{gap:6},
  action:{
    flex:1,minWidth:0,minHeight:46,borderRadius:radius.sm,paddingHorizontal:3,
    paddingVertical:5,alignItems:"center",justifyContent:"center",borderWidth:1,
  },
  detailsButton:{borderColor:colors.primary,backgroundColor:colors.surface},
  detailsLabel:{color:colors.primary,textAlign:"center"},
  reserveButton:{borderColor:colors.primary,backgroundColor:colors.primary},
  reserveDisabled:{opacity:.5},
  reserveLabel:{color:"#FFFFFF",textAlign:"center"},
  pressed:{opacity:.7},
});
