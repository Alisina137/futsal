import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/providers/AuthProvider";
export default function ProtectedLayout(){const {status}=useAuth(); if(status==="anonymous") return <Redirect href="/login"/>; return <Stack screenOptions={{headerShown:false}}/>;}
