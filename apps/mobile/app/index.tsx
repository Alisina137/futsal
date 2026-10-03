import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { colors } from "@leaguekick/design-tokens";
import { useAuth } from "../src/providers/AuthProvider";
export default function Index() { const {status}=useAuth(); if(status==="hydrating") return <View style={{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:colors.background}}><ActivityIndicator color={colors.primary}/></View>; return <Redirect href={status==="authenticated"?"/home":"/login"}/>; }
