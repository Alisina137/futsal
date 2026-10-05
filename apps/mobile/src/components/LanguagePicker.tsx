import Ionicons from "@expo/vector-icons/Ionicons";
import { languages, type LanguageCode } from "@leaguekick/localization";
import { colors, radius, spacing, touchTarget } from "@leaguekick/design-tokens";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocale } from "../providers/LocaleProvider";
import { AppText } from "./ui/AppText";

export function LanguagePicker() {
  const { language, setLanguage, isRTL } = useLocale();

  return <View style={[styles.row,{flexDirection:isRTL?"row-reverse":"row"}]}>
    {languages.map((item)=>{
      const selected=item.code===language;
      return <Pressable
        key={item.code}
        accessibilityRole="radio"
        accessibilityLabel={item.nativeName}
        accessibilityState={{checked:selected}}
        onPress={()=>void setLanguage(item.code as LanguageCode)}
        style={({pressed})=>[
          styles.item,
          selected&&styles.selected,
          pressed&&styles.pressed,
        ]}
      >
        <View style={[styles.itemContent,{flexDirection:isRTL?"row-reverse":"row"}]}>
          {selected?<Ionicons name="checkmark-circle" size={18} color={colors.primary}/>:null}
          <AppText
            weight={selected?"semibold":"regular"}
            style={selected?{color:colors.primary}:undefined}
          >
            {item.nativeName}
          </AppText>
        </View>
      </Pressable>;
    })}
  </View>;
}

const styles=StyleSheet.create({
  row:{
    gap:spacing.sm,
    flexWrap:"wrap",
  },
  item:{
    minHeight:touchTarget,
    paddingHorizontal:spacing.md,
    alignItems:"center",
    justifyContent:"center",
    borderWidth:1,
    borderColor:colors.border,
    borderRadius:radius.pill,
    backgroundColor:colors.surface,
  },
  selected:{
    borderColor:"#AFC7F5",
    backgroundColor:colors.primarySoft,
  },
  pressed:{
    opacity:0.78,
  },
  itemContent:{
    alignItems:"center",
    gap:spacing.xs,
  },
});
