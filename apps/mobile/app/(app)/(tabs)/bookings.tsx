import type {BookingDto} from "@leaguekick/contracts";
import {useFocusEffect,useLocalSearchParams} from "expo-router";
import {useCallback,useRef,useState} from "react";
import {ReservationsPanel} from "../../../src/components/bookings/ReservationsPanel";
import {Screen} from "../../../src/components/ui/Screen";
import {bookingApi} from "../../../src/lib/api";
import {useAuth} from "../../../src/providers/AuthProvider";
import {useLocale} from "../../../src/providers/LocaleProvider";
import {useNetwork} from "../../../src/providers/NetworkProvider";

export default function MyBookingsScreen(){
  const {session}=useAuth();
  const {bookingId}=useLocalSearchParams<{bookingId?:string}>();
  const {t}=useLocale();
  const {reconnectVersion}=useNetwork();
  const userId=session?.user.id??null,token=session?.accessToken;
  const [items,setItems]=useState<BookingDto[]>([]);
  const [loadedUser,setLoadedUser]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const requestId=useRef(0);
  const safeItems=loadedUser===userId?items:[];
  const load=useCallback(async()=>{
    const attempt=++requestId.current;
    if(!token||!userId){
      setItems([]);setLoadedUser(null);setLoading(false);setError(null);
      return;
    }
    setLoading(true);setError(null);
    try{
      const response=await bookingApi.mine(token);
      if(attempt!==requestId.current)return;
      // The API is actor-scoped. Also refuse to render a record attributed
      // to a different account if a cached/old response ever leaks through.
      setItems(response.bookings.filter(item=>item.playerUserId===userId));
      setLoadedUser(userId);
    }catch{
      if(attempt===requestId.current)setError(t("booking.loadBookingsError"));
    }finally{
      if(attempt===requestId.current)setLoading(false);
    }
  },[token,userId,t]);
  useFocusEffect(useCallback(()=>{
    void load();
    return()=>{requestId.current++;};
  },[load,reconnectVersion]));
  async function cancel(id:string){
    if(!token||!userId)throw Error("Session unavailable");
    const result=await bookingApi.cancel(token,id);
    setItems(previous=>previous.map(item=>item.id===id?result.booking:item));
    void load();
  }
  return <Screen showHeader publicNav
    refreshing={loading&&safeItems.length>0} onRefresh={()=>void load()}>
    <ReservationsPanel items={safeItems} loading={loading} error={error}
      onRefresh={()=>void load()} onCancel={cancel} focusBookingId={bookingId}/>
  </Screen>;
}
