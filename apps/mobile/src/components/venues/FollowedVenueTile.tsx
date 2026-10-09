import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radius, spacing } from "@leaguekick/design-tokens";
import type { FollowedVenueDto } from "@leaguekick/contracts";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { resolveMediaImageUrl } from "../../lib/api";
import { AppText } from "../ui/AppText";

export function FollowedVenueTile({venue}:{venue:FollowedVenueDto}){
  const image=resolveMediaImageUrl(venue.imageUrl);
  return <Pressable
    testID={`followed-venue-${venue.id}`}
    accessibilityRole="button"
    accessibilityLabel={venue.name}
    accessibilityHint={venue.city}
    onPress={()=>router.push({pathname:"/venues/[venueId]",params:{venueId:venue.id}})}
    style={({pressed})=>[styles.tile,pressed&&styles.pressed]}
  >
    {image?<Image source={{uri:image}} style={styles.logo} resizeMode="cover"/>:
      <View style={[styles.logo,styles.logoPlaceholder]}>
        <Ionicons name="football-outline" color={colors.primary} size={24}/>
      </View>}
    <AppText weight="semibold" variant="caption" numberOfLines={2} style={styles.name}>
      {venue.name}
    </AppText>
  </Pressable>;
}

const styles=StyleSheet.create({
  tile:{
    width:104,minHeight:112,paddingVertical:spacing.sm,paddingHorizontal:spacing.xs,
    borderRadius:radius.md,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,
    alignItems:"center",justifyContent:"flex-start",gap:spacing.xs,
  },
  logo:{width:60,height:60,borderRadius:30,backgroundColor:colors.surfaceMuted},
  logoPlaceholder:{alignItems:"center",justifyContent:"center"},
  name:{width:"100%",textAlign:"center",minHeight:35},
  pressed:{opacity:.75,backgroundColor:colors.primarySoft},
});
