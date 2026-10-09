import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { FollowedVenueDto } from "@leaguekick/contracts";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { resolveMediaImageUrl } from "../../lib/api";
import { useLocale } from "../../providers/LocaleProvider";
import { AppText } from "../ui/AppText";

/** Two independent actions: the upper card opens details and the blue CTA jumps
 *  to live booking availability. Neither action can accidentally trigger the other. */
export function FollowedVenueTile({venue}:{venue:FollowedVenueDto}){
  const {t,isRTL}=useLocale();
  const image=resolveMediaImageUrl(venue.imageUrl);
  const openDetails=()=>router.push({pathname:"/venues/[venueId]",params:{venueId:venue.id}});
  const openBooking=()=>router.push({pathname:"/venues/[venueId]",params:{venueId:venue.id,focusAvailability:"1"}});

  return <View testID={`followed-venue-${venue.id}`} style={styles.tile}>
    <Pressable
      testID={`followed-venue-details-${venue.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${t("booking.venueDetails")}: ${venue.name}`}
      accessibilityHint={venue.city}
      onPress={openDetails}
      style={({pressed})=>[styles.detailsTarget,pressed&&styles.pressed]}
    >
      {image?<Image source={{uri:image}} style={styles.logo} resizeMode="cover"/>:
        <View style={[styles.logo,styles.logoPlaceholder]}>
          <Ionicons name="football-outline" color={colors.primary} size={24}/>
        </View>}
      <AppText weight="semibold" variant="caption" numberOfLines={2} style={styles.name}>
        {venue.name}
      </AppText>
      <View style={[styles.detailsCue,{flexDirection:isRTL?"row-reverse":"row"}]}>
        <AppText weight="semibold" variant="caption" numberOfLines={2} style={styles.detailsLabel}>
          {t("booking.venueDetails")}
        </AppText>
        <Ionicons name={isRTL?"chevron-back":"chevron-forward"} size={16} color={colors.primary}/>
      </View>
    </Pressable>
    <Pressable
      testID={`followed-venue-reserve-${venue.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${t("booking.reserveOnline")}: ${venue.name}`}
      onPress={openBooking}
      style={({pressed})=>[styles.reserveButton,pressed&&styles.reservePressed]}
    >
      <AppText weight="bold" variant="caption" numberOfLines={2} style={styles.reserveLabel}>
        {t("booking.reserveOnline")}
      </AppText>
    </Pressable>
  </View>;
}

const styles=StyleSheet.create({
  tile:{
    width:148,minHeight:208,borderRadius:radius.md,borderWidth:1,
    borderColor:colors.border,backgroundColor:colors.surface,
    padding:6,gap:6,justifyContent:"space-between",
  },
  detailsTarget:{
    flex:1,minHeight:148,alignItems:"center",justifyContent:"flex-start",
    borderRadius:radius.sm,backgroundColor:colors.surface,
    paddingHorizontal:4,paddingTop:8,paddingBottom:5,gap:5,
  },
  logo:{width:64,height:64,borderRadius:32,backgroundColor:colors.surfaceMuted},
  logoPlaceholder:{alignItems:"center",justifyContent:"center"},
  name:{width:"100%",textAlign:"center",minHeight:35},
  detailsCue:{
    alignItems:"center",justifyContent:"center",gap:2,
    width:"100%",minHeight:28,marginTop:"auto",
    borderRadius:radius.sm,backgroundColor:colors.primarySoft,paddingHorizontal:3,
  },
  detailsLabel:{color:colors.primary,textAlign:"center",flexShrink:1},
  reserveButton:{
    width:"100%",minHeight:44,borderRadius:radius.sm,backgroundColor:colors.primary,
    alignItems:"center",justifyContent:"center",paddingHorizontal:4,paddingVertical:4,
  },
  reserveLabel:{color:"#FFFFFF",textAlign:"center"},
  pressed:{opacity:.73,backgroundColor:colors.primarySoft},
  reservePressed:{opacity:.75},
});
